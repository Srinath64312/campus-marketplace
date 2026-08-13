"""Shared read-model helpers: serialization, markdown clock, alert fan-out."""

from __future__ import annotations

from sqlmodel import Session, col, func, select

from app.models import Alert, Listing, ListingStatus, Review, SavedSearch, User, WishlistItem, utcnow
from app.pricing import deal_score
from app.schemas import DealScoreOut, ListingOut, SellerSummary
from app.search import tokenize
from app.trust import compute_trust


def effective_price(listing: Listing) -> float:
    """Auto-markdown: a leaving-campus seller can let the price bleed to a deadline."""
    if not listing.auto_markdown_percent or not listing.markdown_deadline:
        return round(listing.price, 2)
    start = listing.created_at
    end = listing.markdown_deadline
    if end <= start:
        return round(listing.price, 2)
    now = utcnow()
    progress = (now - start).total_seconds() / (end - start).total_seconds()
    progress = max(0.0, min(1.0, progress))
    return round(listing.price * (1 - (listing.auto_markdown_percent / 100) * progress), 2)


def seller_summary(session: Session, user: User) -> SellerSummary:
    listings = list(session.exec(select(Listing).where(Listing.seller_id == user.id)))
    reviews = list(session.exec(select(Review).where(Review.seller_id == user.id)))
    trust = compute_trust(user, listings, reviews)
    return SellerSummary(
        id=int(user.id or 0),
        name=user.name,
        avatar_seed=user.avatar_seed,
        hostel_block=user.hostel_block,
        trust_score=trust.score,
        trust_tier=trust.tier,
        rating=trust.rating,
    )


def to_listing_out(
    session: Session,
    listing: Listing,
    *,
    market: list[Listing] | None = None,
    viewer: User | None = None,
) -> ListingOut:
    seller = session.get(User, listing.seller_id)
    summary = (
        seller_summary(session, seller)
        if seller
        else SellerSummary(id=0, name="Unknown", avatar_seed="ghost", trust_score=0, trust_tier="new_here")
    )

    if market is None:
        market = list(session.exec(select(Listing).where(Listing.status == ListingStatus.active)))
    score = deal_score(listing, market)

    saved = False
    if viewer is not None:
        saved = (
            session.exec(
                select(WishlistItem).where(
                    WishlistItem.user_id == viewer.id, WishlistItem.listing_id == listing.id
                )
            ).first()
            is not None
        )

    wishlist_count = (
        session.exec(
            select(func.count()).select_from(WishlistItem).where(WishlistItem.listing_id == listing.id)
        ).one()
        or 0
    )

    return ListingOut(
        id=int(listing.id or 0),
        title=listing.title,
        description=listing.description,
        price=round(listing.price, 2),
        effective_price=effective_price(listing),
        category=listing.category,
        condition=listing.condition,
        mode=listing.mode,
        status=listing.status,
        images=listing.images or [],
        tags=listing.tags or [],
        swap_wants=listing.swap_wants,
        swap_wants_category=listing.swap_wants_category,
        meetup_spot=listing.meetup_spot,
        location_lat=listing.location_lat,
        location_lng=listing.location_lng,
        views=listing.views,
        auto_markdown_percent=listing.auto_markdown_percent,
        markdown_deadline=listing.markdown_deadline,
        original_price=listing.original_price,
        created_at=listing.created_at,
        updated_at=listing.updated_at,
        seller=summary,
        deal=DealScoreOut(**score.__dict__) if score else None,
        saved=saved,
        wishlist_count=int(wishlist_count),
    )


def fan_out_alerts(session: Session, listing: Listing) -> int:
    """Notify every student whose standing want-ad matches a brand new listing."""
    searches = list(session.exec(select(SavedSearch).where(SavedSearch.user_id != listing.seller_id)))
    haystack = set(tokenize(f"{listing.title} {listing.description} {' '.join(listing.tags or [])}"))
    created = 0
    for saved in searches:
        if saved.category and saved.category != listing.category:
            continue
        if saved.max_price is not None and listing.price > saved.max_price:
            continue
        if saved.query:
            needles = set(tokenize(saved.query))
            if needles and not (needles & haystack):
                continue
        session.add(
            Alert(
                user_id=saved.user_id,
                listing_id=listing.id,
                kind="match",
                message=f'New match for "{saved.label}": {listing.title}',
            )
        )
        created += 1
    if created:
        session.commit()
    return created


def notify_wishlist_price_drop(session: Session, listing: Listing, old_price: float) -> int:
    if listing.price >= old_price:
        return 0
    watchers = list(session.exec(select(WishlistItem).where(WishlistItem.listing_id == listing.id)))
    drop = round((1 - listing.price / old_price) * 100)
    for item in watchers:
        session.add(
            Alert(
                user_id=item.user_id,
                listing_id=listing.id,
                kind="price_drop",
                message=f"{listing.title} dropped {drop}% to ₹{int(listing.price)}",
            )
        )
    if watchers:
        session.commit()
    return len(watchers)


def active_market(session: Session) -> list[Listing]:
    return list(
        session.exec(
            select(Listing).where(col(Listing.status).in_([ListingStatus.active, ListingStatus.reserved]))
        )
    )
