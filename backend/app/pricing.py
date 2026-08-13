"""Explainable price intelligence.

Two related things live here:

* ``suggest_price`` - what a seller should ask for, derived from comparable
  campus listings, a condition depreciation curve and keyword signals.
* ``deal_score``   - how a live listing compares with its own market, surfaced
  to buyers as a Steal / Fair / Above-market badge.

It is deliberately a transparent statistical model rather than an opaque call to
an external LLM: it runs offline, costs nothing and can explain every rupee.
"""

from __future__ import annotations

import statistics
from dataclasses import dataclass, field

from app.models import Category, Condition, Listing
from app.search import fuzzy_ratio, tokenize

# Fallback anchors (INR) when a category has too few comparables to learn from.
CATEGORY_BASELINE: dict[Category, float] = {
    Category.books: 350,
    Category.electronics: 6500,
    Category.calculators: 1200,
    Category.cycles: 3800,
    Category.notes: 150,
    Category.furniture: 1800,
    Category.stationery: 200,
    Category.apparel: 600,
    Category.sports: 900,
    Category.lab_equipment: 700,
    Category.other: 500,
}

CONDITION_FACTOR: dict[Condition, float] = {
    Condition.new: 1.0,
    Condition.like_new: 0.82,
    Condition.good: 0.65,
    Condition.fair: 0.48,
    Condition.worn: 0.3,
}

# Keyword signals nudge the estimate the way a human haggler would.
PREMIUM_KEYWORDS = {
    "macbook": 2.6,
    "apple": 1.8,
    "ipad": 1.9,
    "dell": 1.25,
    "lenovo": 1.2,
    "hp": 1.15,
    "gaming": 1.35,
    "ti": 1.2,
    "casio": 1.1,
    "hero": 1.1,
    "btwin": 1.3,
    "geared": 1.25,
    "original": 1.1,
    "sealed": 1.2,
    "warranty": 1.15,
}
DISCOUNT_KEYWORDS = {
    "photocopy": 0.45,
    "xerox": 0.5,
    "torn": 0.6,
    "scratched": 0.75,
    "broken": 0.4,
    "repair": 0.55,
    "old": 0.85,
    "used": 0.95,
    "damaged": 0.5,
}

MIN_COMPARABLES = 3
# How alike two same-category listings must read before one prices the other.
PEER_SIMILARITY = 0.15
# A peer more than this many times cheaper/dearer is a different kind of thing.
PEER_PRICE_RATIO = 3.0


def _drop_outliers(pairs: list[tuple[float, float]]) -> list[tuple[float, float]]:
    """Discard comps priced wildly away from the pack (a laptop next to a calculator)."""
    median = statistics.median([price for price, _ in pairs])
    kept = [pair for pair in pairs if median * 0.3 <= pair[0] <= median * 3]
    return kept or pairs


def _weighted_median(pairs: list[tuple[float, float]]) -> float:
    ordered = sorted(pairs)
    half = sum(weight for _, weight in ordered) / 2
    running = 0.0
    for price, weight in ordered:
        running += weight
        if running >= half:
            return price
    return ordered[-1][0]


@dataclass
class PriceSuggestion:
    suggested: float
    low: float
    high: float
    confidence: float
    currency: str = "INR"
    comparables: int = 0
    rationale: list[str] = field(default_factory=list)


def _text_of(listing: Listing) -> str:
    return f"{listing.title} {listing.description or ''} {' '.join(listing.tags or [])}"


def _similarity(text_a: str, text_b: str) -> float:
    a, b = set(tokenize(text_a)), set(tokenize(text_b))
    if not a or not b:
        return 0.0
    exact = len(a & b) / len(a | b)
    if exact:
        return exact
    # fall back to fuzzy token pairing so "calulator" still finds "calculator";
    # only near-identical tokens count, otherwise unrelated items sneak in as comps
    best = 0.0
    for ta in a:
        for tb in b:
            best = max(best, fuzzy_ratio(ta, tb))
    return best * 0.6 if best >= 0.82 else 0.0


def _peer_overlap(listing_a: Listing, listing_b: Listing) -> float:
    """Overlap of the naming words (title + tags) of two listings, ignoring prose."""
    a = set(tokenize(f"{listing_a.title} {' '.join(listing_a.tags or [])}"))
    b = set(tokenize(f"{listing_b.title} {' '.join(listing_b.tags or [])}"))
    if not a or not b:
        return 0.0
    return len(a & b) / min(len(a), len(b))


def _keyword_multiplier(text: str) -> tuple[float, list[str]]:
    tokens = set(tokenize(text))
    multiplier = 1.0
    notes: list[str] = []
    for token in tokens:
        if token in PREMIUM_KEYWORDS:
            multiplier *= PREMIUM_KEYWORDS[token] ** 0.5
            notes.append(f"'{token}' reads as a premium signal")
        if token in DISCOUNT_KEYWORDS:
            multiplier *= DISCOUNT_KEYWORDS[token] ** 0.5
            notes.append(f"'{token}' pulls the estimate down")
    return max(0.25, min(multiplier, 3.5)), notes


def find_comparables(
    listings: list[Listing],
    *,
    title: str,
    description: str,
    category: Category,
    exclude_id: int | None = None,
) -> list[tuple[Listing, float]]:
    subject = f"{title} {description}"
    scored: list[tuple[Listing, float]] = []
    for listing in listings:
        if listing.id == exclude_id or listing.price <= 0:
            continue
        similarity = _similarity(subject, _text_of(listing))
        if listing.category == category:
            similarity += 0.35
        if similarity >= 0.2:
            scored.append((listing, round(similarity, 3)))
    scored.sort(key=lambda pair: pair[1], reverse=True)
    return scored[:12]


def suggest_price(
    listings: list[Listing],
    *,
    title: str,
    description: str,
    category: Category,
    condition: Condition,
    age_months: int = 0,
    exclude_id: int | None = None,
) -> PriceSuggestion:
    rationale: list[str] = []
    comps = find_comparables(
        listings, title=title, description=description, category=category, exclude_id=exclude_id
    )

    condition_factor = CONDITION_FACTOR[condition]
    # Gentle exponential decay: ~2%/month, floored so nothing goes to zero.
    age_factor = max(0.4, 0.98**age_months)

    if len(comps) >= MIN_COMPARABLES:
        pairs = [(listing.price / CONDITION_FACTOR[listing.condition], weight) for listing, weight in comps]
        pairs = _drop_outliers(pairs)
        base = _weighted_median(pairs)
        prices = [price for price, _ in pairs]
        spread = statistics.pstdev(prices) if len(prices) > 1 else base * 0.2
        confidence = min(0.94, 0.45 + 0.06 * len(comps))
        rationale.append(
            f"Anchored on {len(comps)} similar campus listings "
            f"(median ask ₹{int(statistics.median([listing.price for listing, _ in comps]))})"
        )
    else:
        base = CATEGORY_BASELINE[category]
        spread = base * 0.35
        confidence = 0.35
        rationale.append(
            f"Only {len(comps)} close comparables on campus, so this leans on the "
            f"{category.value.replace('_', ' ')} baseline"
        )

    multiplier, keyword_notes = _keyword_multiplier(f"{title} {description}")
    rationale.extend(keyword_notes)

    suggested = base * condition_factor * age_factor * multiplier
    rationale.append(
        f"Condition '{condition.value.replace('_', ' ')}' applies a "
        f"{int((1 - condition_factor) * 100)}% haircut"
    )
    if age_months:
        rationale.append(f"{age_months} months of age trims another {int((1 - age_factor) * 100)}%")

    # keep the band honest: wide enough to be useful, never collapsing to "free"
    band = min(max(spread * condition_factor * 0.75, suggested * 0.12), suggested * 0.4)
    return PriceSuggestion(
        suggested=round(suggested, -1) if suggested > 100 else round(suggested, 0),
        low=max(0.0, round(suggested - band, -1) if suggested > 100 else round(suggested - band, 0)),
        high=round(suggested + band, -1) if suggested > 100 else round(suggested + band, 0),
        confidence=round(confidence, 2),
        comparables=len(comps),
        rationale=rationale,
    )


@dataclass
class DealScore:
    label: str
    score: int  # 0-100, higher is a better buy
    delta_percent: float
    market_price: float
    basis: int


def deal_score(listing: Listing, market: list[Listing]) -> DealScore | None:
    """Compare a listing with textually similar, condition-normalised peers.

    Category alone is too coarse — headphones are not laptops — so a badge only
    appears when the same category holds items that actually resemble this one,
    both in wording and in order of magnitude.
    """
    peers = [
        other
        for other in market
        if other.id != listing.id
        and other.category == listing.category
        and other.price > 0
        and _peer_overlap(listing, other) >= PEER_SIMILARITY
        and listing.price / PEER_PRICE_RATIO <= other.price <= listing.price * PEER_PRICE_RATIO
    ]
    if listing.price <= 0 or len(peers) < 2:
        return None

    normalised = [other.price / CONDITION_FACTOR[other.condition] for other in peers]
    market_median = statistics.median(normalised) * CONDITION_FACTOR[listing.condition]
    if market_median <= 0:
        return None

    delta = (listing.price - market_median) / market_median
    score = int(max(0, min(100, round(50 - delta * 100))))
    if delta <= -0.25:
        label = "steal"
    elif delta <= -0.08:
        label = "good_deal"
    elif delta < 0.15:
        label = "fair"
    else:
        label = "above_market"
    return DealScore(
        label=label,
        score=score,
        delta_percent=round(delta * 100, 1),
        market_price=round(market_median, 0),
        basis=len(peers),
    )
