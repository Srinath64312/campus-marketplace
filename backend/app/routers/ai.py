from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.db import get_session
from app.pricing import suggest_price
from app.schemas import PriceSuggestRequest, PriceSuggestResponse
from app.services import active_market

router = APIRouter(prefix="/api/ai", tags=["intelligence"])


@router.post("/price-suggest", response_model=PriceSuggestResponse)
def price_suggest(
    payload: PriceSuggestRequest, session: Session = Depends(get_session)
) -> PriceSuggestResponse:
    """Suggest an asking price with a confidence band and a human-readable rationale."""
    suggestion = suggest_price(
        active_market(session),
        title=payload.title,
        description=payload.description,
        category=payload.category,
        condition=payload.condition,
        age_months=payload.age_months,
        exclude_id=payload.listing_id,
    )
    return PriceSuggestResponse(**suggestion.__dict__)
