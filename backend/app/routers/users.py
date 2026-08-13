from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.db import get_session
from app.models import Listing, ListingStatus, Report, Review, User, utcnow
from app.schemas import ReportCreate, ReviewCreate, ReviewOut, UserProfile, UserUpdate
from app.security import get_current_user
from app.trust import compute_trust

router = APIRouter(prefix="/api", tags=["users"])


def _profile(session: Session, user: User) -> UserProfile:
    listings = list(session.exec(select(Listing).where(Listing.seller_id == user.id)))
    reviews = list(session.exec(select(Review).where(Review.seller_id == user.id)))
    trust = compute_trust(user, listings, reviews)
    return UserProfile(
        id=int(user.id or 0),
        name=user.name,
        email=user.email,  # type: ignore[arg-type]
        campus=user.campus,
        hostel_block=user.hostel_block,
        grad_year=user.grad_year,
        bio=user.bio,
        avatar_seed=user.avatar_seed,
        is_email_verified=user.is_email_verified,
        created_at=user.created_at,
        trust_score=trust.score,
        trust_tier=trust.tier,
        rating=trust.rating,
        reviews=trust.reviews,
        completed_deals=trust.completed_deals,
        trust_signals=trust.signals,
        active_listings=sum(1 for x in listings if x.status == ListingStatus.active),
    )


@router.get("/users/{user_id}", response_model=UserProfile)
def get_profile(user_id: int, session: Session = Depends(get_session)) -> UserProfile:
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return _profile(session, user)


@router.patch("/me", response_model=UserProfile)
def update_me(
    payload: UserUpdate, session: Session = Depends(get_session), user: User = Depends(get_current_user)
) -> UserProfile:
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(user, key, value)
    session.add(user)
    session.commit()
    session.refresh(user)
    return _profile(session, user)


@router.get("/users/{user_id}/reviews", response_model=list[ReviewOut])
def list_reviews(user_id: int, session: Session = Depends(get_session)) -> list[ReviewOut]:
    rows = list(session.exec(select(Review).where(Review.seller_id == user_id)))
    out: list[ReviewOut] = []
    for row in rows:
        author = session.get(User, row.author_id)
        out.append(
            ReviewOut(
                id=int(row.id or 0),
                seller_id=row.seller_id,
                author_id=row.author_id,
                author_name=author.name if author else "Student",
                rating=row.rating,
                comment=row.comment,
                created_at=row.created_at,
            )
        )
    out.sort(key=lambda r: r.created_at, reverse=True)
    return out


@router.post("/reviews", response_model=ReviewOut, status_code=201)
def create_review(
    payload: ReviewCreate, session: Session = Depends(get_session), user: User = Depends(get_current_user)
) -> ReviewOut:
    if payload.seller_id == user.id:
        raise HTTPException(status_code=400, detail="You cannot review yourself")
    if not session.get(User, payload.seller_id):
        raise HTTPException(status_code=404, detail="Seller not found")
    review = Review(author_id=int(user.id or 0), **payload.model_dump())
    session.add(review)
    session.commit()
    session.refresh(review)
    return ReviewOut(
        id=int(review.id or 0),
        seller_id=review.seller_id,
        author_id=review.author_id,
        author_name=user.name,
        rating=review.rating,
        comment=review.comment,
        created_at=review.created_at,
    )


@router.post("/reports", status_code=201)
def create_report(
    payload: ReportCreate, session: Session = Depends(get_session), user: User = Depends(get_current_user)
) -> dict:
    listing = session.get(Listing, payload.listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    session.add(Report(reporter_id=int(user.id or 0), **payload.model_dump()))
    session.commit()

    count = len(list(session.exec(select(Report).where(Report.listing_id == payload.listing_id))))
    auto_hidden = False
    if count >= 3 and listing.status == ListingStatus.active:
        listing.status = ListingStatus.archived
        listing.updated_at = utcnow()
        session.add(listing)
        session.commit()
        auto_hidden = True
    return {"reports": count, "auto_hidden": auto_hidden}
