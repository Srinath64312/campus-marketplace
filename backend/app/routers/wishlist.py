from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.db import get_session
from app.models import Alert, Listing, SavedSearch, User, WishlistItem
from app.schemas import AlertOut, ListingOut, SavedSearchCreate, SavedSearchOut
from app.security import get_current_user
from app.services import active_market, to_listing_out

router = APIRouter(prefix="/api", tags=["wishlist"])


@router.get("/wishlist", response_model=list[ListingOut])
def get_wishlist(
    session: Session = Depends(get_session), user: User = Depends(get_current_user)
) -> list[ListingOut]:
    items = list(session.exec(select(WishlistItem).where(WishlistItem.user_id == user.id)))
    market = active_market(session)
    out: list[ListingOut] = []
    for item in items:
        listing = session.get(Listing, item.listing_id)
        if listing:
            out.append(to_listing_out(session, listing, market=market, viewer=user))
    return out


@router.post("/wishlist/{listing_id}", response_model=ListingOut, status_code=201)
def add_to_wishlist(
    listing_id: int, session: Session = Depends(get_session), user: User = Depends(get_current_user)
) -> ListingOut:
    listing = session.get(Listing, listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    existing = session.exec(
        select(WishlistItem).where(WishlistItem.user_id == user.id, WishlistItem.listing_id == listing_id)
    ).first()
    if not existing:
        session.add(WishlistItem(user_id=int(user.id or 0), listing_id=listing_id))
        session.commit()
    return to_listing_out(session, listing, viewer=user)


@router.delete("/wishlist/{listing_id}", status_code=204)
def remove_from_wishlist(
    listing_id: int, session: Session = Depends(get_session), user: User = Depends(get_current_user)
) -> None:
    existing = session.exec(
        select(WishlistItem).where(WishlistItem.user_id == user.id, WishlistItem.listing_id == listing_id)
    ).first()
    if existing:
        session.delete(existing)
        session.commit()


@router.get("/saved-searches", response_model=list[SavedSearchOut])
def list_saved_searches(
    session: Session = Depends(get_session), user: User = Depends(get_current_user)
) -> list[SavedSearchOut]:
    rows = session.exec(select(SavedSearch).where(SavedSearch.user_id == user.id))
    return [SavedSearchOut.model_validate(r, from_attributes=True) for r in rows]


@router.post("/saved-searches", response_model=SavedSearchOut, status_code=201)
def create_saved_search(
    payload: SavedSearchCreate,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
) -> SavedSearchOut:
    row = SavedSearch(user_id=int(user.id or 0), **payload.model_dump())
    session.add(row)
    session.commit()
    session.refresh(row)
    return SavedSearchOut.model_validate(row, from_attributes=True)


@router.delete("/saved-searches/{search_id}", status_code=204)
def delete_saved_search(
    search_id: int, session: Session = Depends(get_session), user: User = Depends(get_current_user)
) -> None:
    row = session.get(SavedSearch, search_id)
    if not row or row.user_id != user.id:
        raise HTTPException(status_code=404, detail="Saved search not found")
    session.delete(row)
    session.commit()


@router.get("/alerts", response_model=list[AlertOut])
def list_alerts(
    session: Session = Depends(get_session), user: User = Depends(get_current_user)
) -> list[AlertOut]:
    rows = session.exec(
        select(Alert).where(Alert.user_id == user.id).order_by(Alert.created_at.desc())  # type: ignore[attr-defined]
    )
    return [AlertOut.model_validate(r, from_attributes=True) for r in rows]


@router.post("/alerts/read", status_code=204)
def mark_alerts_read(session: Session = Depends(get_session), user: User = Depends(get_current_user)) -> None:
    rows = list(session.exec(select(Alert).where(Alert.user_id == user.id, Alert.read == False)))  # noqa: E712
    for row in rows:
        row.read = True
        session.add(row)
    if rows:
        session.commit()
