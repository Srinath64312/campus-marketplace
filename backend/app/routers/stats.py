import statistics
from collections import Counter, defaultdict
from datetime import timedelta

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from app.db import get_session
from app.models import Listing, ListingMode, ListingStatus, User, utcnow
from app.schemas import StatsOut
from app.swaps import build_graph, find_cycles

router = APIRouter(prefix="/api", tags=["stats"])

# Curated safe hand-off points; a marketplace meetup should never be "somewhere near hostel".
MEETUP_SPOTS = [
    {"name": "Central Library steps", "lat": 12.9722, "lng": 77.5951, "safety": "high", "hours": "8am-10pm"},
    {"name": "Main Canteen", "lat": 12.9735, "lng": 77.5968, "safety": "high", "hours": "7am-11pm"},
    {"name": "Admin Block reception", "lat": 12.9711, "lng": 77.5939, "safety": "high", "hours": "9am-6pm"},
    {"name": "Sports Complex gate", "lat": 12.9748, "lng": 77.5982, "safety": "medium", "hours": "6am-9pm"},
    {"name": "Hostel A common room", "lat": 12.9702, "lng": 77.5995, "safety": "medium", "hours": "24h"},
    {"name": "Hostel B common room", "lat": 12.9694, "lng": 77.6008, "safety": "medium", "hours": "24h"},
    {"name": "CS Department lobby", "lat": 12.9729, "lng": 77.5925, "safety": "high", "hours": "8am-8pm"},
]


@router.get("/meetup-spots")
def meetup_spots() -> list[dict]:
    return MEETUP_SPOTS


@router.get("/stats", response_model=StatsOut)
def stats(session: Session = Depends(get_session)) -> StatsOut:
    listings = list(session.exec(select(Listing)))
    users = list(session.exec(select(User)))
    active = [x for x in listings if x.status == ListingStatus.active]

    prices = [x.price for x in active if x.price > 0]
    counter = Counter(x.category.value for x in active)

    buckets: dict[str, int] = defaultdict(int)
    today = utcnow().date()
    for offset in range(13, -1, -1):
        buckets[str(today - timedelta(days=offset))] = 0
    for listing in listings:
        key = str(listing.created_at.date())
        if key in buckets:
            buckets[key] += 1

    rings = find_cycles(build_graph(active))

    return StatsOut(
        total_listings=len(listings),
        active_listings=len(active),
        given_away=sum(1 for x in listings if x.mode == ListingMode.giveaway),
        students=len(users),
        median_price=round(statistics.median(prices), 2) if prices else 0.0,
        trending_categories=[{"category": c, "count": n} for c, n in counter.most_common(6)],
        daily_new=[{"date": d, "count": n} for d, n in sorted(buckets.items())],
        swap_rings_open=len(rings),
    )
