"""Composite seller trust score.

A star average alone is gameable and useless for a first-time seller, so the
score blends four signals and always explains itself.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta

from app.models import Listing, ListingStatus, Review, User, utcnow


@dataclass
class TrustScore:
    score: int
    tier: str
    rating: float | None
    reviews: int
    completed_deals: int
    signals: list[str]


def _tier(score: int) -> str:
    if score >= 85:
        return "trusted_senior"
    if score >= 65:
        return "reliable"
    if score >= 40:
        return "getting_started"
    return "new_here"


def compute_trust(user: User, listings: list[Listing], reviews: list[Review]) -> TrustScore:
    signals: list[str] = []
    score = 30.0

    ratings = [r.rating for r in reviews]
    average = round(sum(ratings) / len(ratings), 2) if ratings else None
    if average is not None:
        score += (average - 3) * 12
        signals.append(f"{average}★ across {len(ratings)} reviews")

    completed = sum(1 for x in listings if x.status == ListingStatus.sold)
    score += min(20.0, completed * 4)
    if completed:
        signals.append(f"{completed} completed deals")

    if user.is_email_verified:
        score += 12
        signals.append("Verified campus email")

    tenure_days = (utcnow() - user.created_at).days
    score += min(10.0, tenure_days / 30)
    if tenure_days >= 30:
        signals.append(f"Active for {tenure_days // 30} month(s)")

    fresh_cutoff: datetime = utcnow() - timedelta(days=14)
    if any(x.created_at >= fresh_cutoff for x in listings):
        score += 5
        signals.append("Posted in the last two weeks")

    if not signals:
        signals.append("New seller - meet at a busy campus spot")

    final = int(max(0, min(100, round(score))))
    return TrustScore(
        score=final,
        tier=_tier(final),
        rating=average,
        reviews=len(ratings),
        completed_deals=completed,
        signals=signals,
    )
