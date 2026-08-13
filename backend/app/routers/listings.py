import math
from collections import Counter

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, col, select

from app.db import get_session
from app.models import Category, Condition, Listing, ListingMode, ListingStatus, User, utcnow
from app.pricing import find_comparables
from app.schemas import ListingCreate, ListingOut, ListingPage, ListingUpdate
from app.search import search as text_search
from app.security import get_current_user, get_current_user_optional
from app.services import (
    active_market,
    effective_price,
    fan_out_alerts,
    notify_wishlist_price_drop,
    to_listing_out,
)

router = APIRouter(prefix="/api/listings", tags=["listings"])

SORTS = ("recent", "price_asc", "price_desc", "deal", "popular", "nearby")


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    radius = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lng / 2) ** 2
    )
    return 2 * radius * math.asin(math.sqrt(a))


@router.get("", response_model=ListingPage)
def list_listings(
    session: Session = Depends(get_session),
    viewer: User | None = Depends(get_current_user_optional),
    q: str | None = None,
    category: list[Category] | None = Query(default=None),
    condition: list[Condition] | None = Query(default=None),
    mode: ListingMode | None = None,
    status: ListingStatus | None = None,
    seller_id: int | None = None,
    min_price: float | None = None,
    max_price: float | None = None,
    free_only: bool = False,
    lat: float | None = None,
    lng: float | None = None,
    radius_km: float | None = None,
    sort: str = "recent",
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=12, ge=1, le=60),
) -> ListingPage:
    if sort not in SORTS:
        raise HTTPException(status_code=400, detail=f"sort must be one of {', '.join(SORTS)}")

    statement = select(Listing)
    statement = statement.where(Listing.status == (status or ListingStatus.active))
    if category:
        statement = statement.where(col(Listing.category).in_(category))
    if condition:
        statement = statement.where(col(Listing.condition).in_(condition))
    if mode:
        statement = statement.where(Listing.mode == mode)
    if seller_id:
        statement = statement.where(Listing.seller_id == seller_id)

    rows = list(session.exec(statement))

    if free_only:
        rows = [x for x in rows if x.mode == ListingMode.giveaway or effective_price(x) == 0]
    if min_price is not None:
        rows = [x for x in rows if effective_price(x) >= min_price]
    if max_price is not None:
        rows = [x for x in rows if effective_price(x) <= max_price]
    if lat is not None and lng is not None and radius_km:
        rows = [
            x
            for x in rows
            if x.location_lat is not None
            and x.location_lng is not None
            and _haversine_km(lat, lng, x.location_lat, x.location_lng) <= radius_km
        ]

    facets = {
        "category": dict(Counter(x.category.value for x in rows)),
        "condition": dict(Counter(x.condition.value for x in rows)),
        "mode": dict(Counter(x.mode.value for x in rows)),
    }

    if q:
        rows = text_search(rows, q)
    if sort == "recent":
        rows.sort(key=lambda x: x.created_at, reverse=True)
    elif sort == "price_asc":
        rows.sort(key=effective_price)
    elif sort == "price_desc":
        rows.sort(key=effective_price, reverse=True)
    elif sort == "popular":
        rows.sort(key=lambda x: x.views, reverse=True)
    elif sort == "nearby" and lat is not None and lng is not None:
        rows.sort(
            key=lambda x: _haversine_km(lat, lng, x.location_lat or 0.0, x.location_lng or 0.0)
            if x.location_lat is not None
            else 1e9
        )

    total = len(rows)
    start = (page - 1) * page_size
    window = rows[start : start + page_size]

    market = active_market(session)
    items = [to_listing_out(session, x, market=market, viewer=viewer) for x in window]

    if sort == "deal":
        items.sort(key=lambda item: item.deal.score if item.deal else -1, reverse=True)

    return ListingPage(items=items, total=total, page=page, page_size=page_size, facets=facets)


@router.post("", response_model=ListingOut, status_code=201)
def create_listing(
    payload: ListingCreate,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
) -> ListingOut:
    listing = Listing(
        seller_id=int(user.id or 0),
        original_price=payload.price or None,
        **payload.model_dump(),
    )
    if listing.mode == ListingMode.giveaway:
        listing.price = 0.0
    session.add(listing)
    session.commit()
    session.refresh(listing)
    fan_out_alerts(session, listing)
    return to_listing_out(session, listing, viewer=user)


@router.get("/{listing_id}", response_model=ListingOut)
def get_listing(
    listing_id: int,
    session: Session = Depends(get_session),
    viewer: User | None = Depends(get_current_user_optional),
) -> ListingOut:
    listing = session.get(Listing, listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    if not viewer or viewer.id != listing.seller_id:
        listing.views += 1
        session.add(listing)
        session.commit()
        session.refresh(listing)
    return to_listing_out(session, listing, viewer=viewer)


@router.get("/{listing_id}/similar", response_model=list[ListingOut])
def similar_listings(
    listing_id: int,
    limit: int = Query(default=4, ge=1, le=12),
    session: Session = Depends(get_session),
    viewer: User | None = Depends(get_current_user_optional),
) -> list[ListingOut]:
    listing = session.get(Listing, listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    market = active_market(session)
    comps = find_comparables(
        market,
        title=listing.title,
        description=listing.description,
        category=listing.category,
        exclude_id=listing.id,
    )
    return [to_listing_out(session, other, market=market, viewer=viewer) for other, _ in comps[:limit]]


@router.patch("/{listing_id}", response_model=ListingOut)
def update_listing(
    listing_id: int,
    payload: ListingUpdate,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
) -> ListingOut:
    listing = session.get(Listing, listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    if listing.seller_id != user.id:
        raise HTTPException(status_code=403, detail="You can only edit your own listings")

    old_price = listing.price
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(listing, key, value)
    if listing.mode == ListingMode.giveaway:
        listing.price = 0.0
    listing.updated_at = utcnow()
    session.add(listing)
    session.commit()
    session.refresh(listing)
    notify_wishlist_price_drop(session, listing, old_price)
    return to_listing_out(session, listing, viewer=user)


@router.delete("/{listing_id}", status_code=204)
def delete_listing(
    listing_id: int,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
) -> None:
    listing = session.get(Listing, listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    if listing.seller_id != user.id:
        raise HTTPException(status_code=403, detail="You can only delete your own listings")
    session.delete(listing)
    session.commit()
