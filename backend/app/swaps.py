"""Barter ring finder.

Classifieds sites stop at "I'll sell you mine". Campuses actually run on barter,
and barter usually fails because A wants what B has, B wants what C has and C
wants what A has - a loop nobody can see. We build a directed graph over swap
listings (edge X -> Y when Y's item satisfies X's want) and enumerate the short
cycles, so a three-way trade becomes a single click.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.models import Listing, ListingMode, ListingStatus
from app.search import fuzzy_ratio, tokenize

MAX_CYCLE_LENGTH = 4
MATCH_THRESHOLD = 0.34


def _wants_satisfied_by(wanter: Listing, offer: Listing) -> float:
    """How well ``offer`` satisfies what ``wanter`` asked for, in [0, 1]."""
    if wanter.id == offer.id or wanter.seller_id == offer.seller_id:
        return 0.0

    score = 0.0
    if wanter.swap_wants_category and wanter.swap_wants_category == offer.category:
        score += 0.55

    want_tokens = set(tokenize(wanter.swap_wants or ""))
    offer_tokens = set(tokenize(f"{offer.title} {offer.description or ''} {' '.join(offer.tags or [])}"))
    if want_tokens and offer_tokens:
        overlap = len(want_tokens & offer_tokens) / len(want_tokens)
        if overlap:
            score += 0.45 * overlap
        else:
            best = max(
                (fuzzy_ratio(a, b) for a in want_tokens for b in offer_tokens),
                default=0.0,
            )
            if best >= 0.7:
                score += 0.25 * best
    return min(1.0, round(score, 3))


@dataclass
class SwapCycle:
    listing_ids: list[int]
    strength: float
    length: int


def build_graph(listings: list[Listing]) -> dict[int, dict[int, float]]:
    swappable = [
        x
        for x in listings
        if x.mode == ListingMode.swap and x.status == ListingStatus.active and x.id is not None
    ]
    graph: dict[int, dict[int, float]] = {int(x.id): {} for x in swappable}  # type: ignore[arg-type]
    for wanter in swappable:
        for offer in swappable:
            weight = _wants_satisfied_by(wanter, offer)
            if weight >= MATCH_THRESHOLD:
                graph[int(wanter.id)][int(offer.id)] = weight  # type: ignore[arg-type]
    return graph


def find_cycles(graph: dict[int, dict[int, float]], max_length: int = MAX_CYCLE_LENGTH) -> list[SwapCycle]:
    cycles: list[SwapCycle] = []
    seen: set[tuple[int, ...]] = set()

    def canonical(path: list[int]) -> tuple[int, ...]:
        pivot = path.index(min(path))
        return tuple(path[pivot:] + path[:pivot])

    def walk(start: int, node: int, path: list[int], weights: list[float]) -> None:
        for nxt, weight in graph.get(node, {}).items():
            if nxt == start and len(path) >= 2:
                key = canonical(path)
                if key not in seen:
                    seen.add(key)
                    strength = sum(weights + [weight]) / (len(weights) + 1)
                    cycles.append(
                        SwapCycle(listing_ids=list(key), strength=round(strength, 3), length=len(key))
                    )
            elif nxt not in path and len(path) < max_length and nxt > start:
                walk(start, nxt, path + [nxt], weights + [weight])

    for start in sorted(graph):
        walk(start, start, [start], [])

    cycles.sort(key=lambda c: (-c.strength, c.length))
    return cycles


def direct_matches(listings: list[Listing], listing: Listing) -> list[tuple[Listing, float]]:
    """Two-way swaps: they have what I want and I have what they want."""
    out: list[tuple[Listing, float]] = []
    for other in listings:
        if other.mode != ListingMode.swap or other.status != ListingStatus.active:
            continue
        forward = _wants_satisfied_by(listing, other)
        backward = _wants_satisfied_by(other, listing)
        if forward >= MATCH_THRESHOLD and backward >= MATCH_THRESHOLD:
            out.append((other, round((forward + backward) / 2, 3)))
    out.sort(key=lambda pair: pair[1], reverse=True)
    return out
