from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session

from app.db import get_session
from app.models import Listing, ListingMode, User
from app.schemas import ListingOut, SwapMatchOut
from app.security import get_current_user_optional
from app.services import active_market, to_listing_out
from app.swaps import build_graph, direct_matches, find_cycles

router = APIRouter(prefix="/api/swaps", tags=["swaps"])


def _summarise(items: list[ListingOut]) -> str:
    def first_name(item: ListingOut) -> str:
        return item.seller.name.split()[0]

    legs = [f"{first_name(x)}'s {x.title}" for x in items]
    if len(legs) == 2:
        return f"{legs[0]} ⇄ {legs[1]}"
    return " → ".join(legs) + f" → back to {first_name(items[0])}"


@router.get("/rings", response_model=list[SwapMatchOut])
def swap_rings(
    limit: int = Query(default=12, ge=1, le=50),
    session: Session = Depends(get_session),
    viewer: User | None = Depends(get_current_user_optional),
) -> list[SwapMatchOut]:
    """Every open barter loop on campus, including 3- and 4-way trades."""
    market = active_market(session)
    by_id = {int(x.id or 0): x for x in market}
    cycles = find_cycles(build_graph(market))[:limit]

    out: list[SwapMatchOut] = []
    for cycle in cycles:
        items = [
            to_listing_out(session, by_id[i], market=market, viewer=viewer)
            for i in cycle.listing_ids
            if i in by_id
        ]
        if len(items) != cycle.length:
            continue
        out.append(
            SwapMatchOut(
                listings=items,
                strength=cycle.strength,
                length=cycle.length,
                summary=_summarise(items),
            )
        )
    return out


@router.get("/for/{listing_id}", response_model=list[SwapMatchOut])
def swaps_for_listing(
    listing_id: int,
    session: Session = Depends(get_session),
    viewer: User | None = Depends(get_current_user_optional),
) -> list[SwapMatchOut]:
    listing = session.get(Listing, listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    if listing.mode != ListingMode.swap:
        return []

    market = active_market(session)
    by_id = {int(x.id or 0): x for x in market}
    out: list[SwapMatchOut] = []

    for other, strength in direct_matches(market, listing):
        items = [
            to_listing_out(session, listing, market=market, viewer=viewer),
            to_listing_out(session, other, market=market, viewer=viewer),
        ]
        out.append(SwapMatchOut(listings=items, strength=strength, length=2, summary=_summarise(items)))

    for cycle in find_cycles(build_graph(market)):
        if listing_id not in cycle.listing_ids or cycle.length < 3:
            continue
        items = [
            to_listing_out(session, by_id[i], market=market, viewer=viewer)
            for i in cycle.listing_ids
            if i in by_id
        ]
        if len(items) == cycle.length:
            out.append(
                SwapMatchOut(
                    listings=items, strength=cycle.strength, length=cycle.length, summary=_summarise(items)
                )
            )

    out.sort(key=lambda m: (-m.strength, m.length))
    return out
