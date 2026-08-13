"""Typo-tolerant BM25-style ranking over listings.

Kept dependency-free on purpose: the corpus is a campus, not the web, so a small
in-process index beats bolting on a search server.
"""

from __future__ import annotations

import math
import re
from collections import Counter
from dataclasses import dataclass

from app.models import Listing

_TOKEN_RE = re.compile(r"[a-z0-9]+")

_SYNONYMS: dict[str, list[str]] = {
    "cycle": ["bicycle", "bike"],
    "bike": ["bicycle", "cycle"],
    "laptop": ["notebook", "macbook", "thinkpad"],
    "calc": ["calculator"],
    "phone": ["mobile", "smartphone"],
    "notes": ["handwritten", "material"],
    "fan": ["cooler"],
    "table": ["desk"],
    "cheap": [],
}

_STOPWORDS = {"a", "an", "the", "for", "with", "and", "of", "in", "to", "my", "is", "on"}

K1 = 1.4
B = 0.72


def tokenize(text: str) -> list[str]:
    return [t for t in _TOKEN_RE.findall((text or "").lower()) if t not in _STOPWORDS]


def _trigrams(token: str) -> set[str]:
    padded = f"  {token} "
    return {padded[i : i + 3] for i in range(len(padded) - 2)}


def fuzzy_ratio(a: str, b: str) -> float:
    """Trigram Dice coefficient - cheap typo tolerance ("calulator" -> "calculator")."""
    if a == b:
        return 1.0
    ta, tb = _trigrams(a), _trigrams(b)
    if not ta or not tb:
        return 0.0
    return 2 * len(ta & tb) / (len(ta) + len(tb))


def listing_document(listing: Listing) -> str:
    parts = [
        listing.title,
        listing.title,  # title counts double
        listing.description or "",
        listing.category.value.replace("_", " "),
        listing.condition.value.replace("_", " "),
        " ".join(listing.tags or []),
        listing.swap_wants or "",
    ]
    return " ".join(parts)


@dataclass
class Scored:
    listing: Listing
    score: float


def expand_query(query: str) -> list[str]:
    tokens = tokenize(query)
    expanded: list[str] = []
    for token in tokens:
        expanded.append(token)
        expanded.extend(_SYNONYMS.get(token, []))
    return expanded


def rank(listings: list[Listing], query: str) -> list[Scored]:
    """BM25 with a fuzzy fallback so near-miss spellings still match."""
    terms = expand_query(query)
    if not terms:
        return [Scored(listing=x, score=0.0) for x in listings]

    docs = [Counter(tokenize(listing_document(x))) for x in listings]
    lengths = [sum(d.values()) for d in docs]
    avg_len = (sum(lengths) / len(lengths)) if lengths else 0.0
    n_docs = len(docs)

    vocab: set[str] = set()
    for d in docs:
        vocab.update(d)

    # Map each query term to the closest vocabulary token when it is not an exact hit.
    resolved: list[tuple[str, float]] = []
    for term in terms:
        if term in vocab:
            resolved.append((term, 1.0))
            continue
        best, best_score = None, 0.0
        for candidate in vocab:
            if abs(len(candidate) - len(term)) > 3:
                continue
            score = fuzzy_ratio(term, candidate)
            if score > best_score:
                best, best_score = candidate, score
        if best is not None and best_score >= 0.55:
            resolved.append((best, best_score * 0.85))

    scored: list[Scored] = []
    for idx, doc in enumerate(docs):
        total = 0.0
        for term, weight in resolved:
            tf = doc.get(term, 0)
            if not tf:
                continue
            df = sum(1 for d in docs if term in d)
            idf = math.log(1 + (n_docs - df + 0.5) / (df + 0.5))
            denom = tf + K1 * (1 - B + B * (lengths[idx] / avg_len if avg_len else 1))
            total += weight * idf * (tf * (K1 + 1)) / denom
        scored.append(Scored(listing=listings[idx], score=round(total, 4)))
    return scored


def search(listings: list[Listing], query: str, min_score: float = 0.01) -> list[Listing]:
    if not query or not query.strip():
        return listings
    ranked = [s for s in rank(listings, query) if s.score > min_score]
    ranked.sort(key=lambda s: s.score, reverse=True)
    return [s.listing for s in ranked]
