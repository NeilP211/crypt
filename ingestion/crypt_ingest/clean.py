"""Cleaning and deduplication for scraped locations.

OpenStreetMap often holds the same physical site as several overlapping
features (a node and an enclosing way, or duplicate imports). We collapse
near-coincident features with similar names into a single record.
"""

from __future__ import annotations

import math
import re

from .model import RawLocation

EARTH_RADIUS_M = 6_371_000.0


def haversine_meters(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance between two WGS84 points, in meters."""
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = (
        math.sin(dphi / 2) ** 2
        + math.cos(p1) * math.cos(p2) * math.sin(dlambda / 2) ** 2
    )
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(a))


def _normalize_name(name: str) -> str:
    """Lowercase, strip punctuation and collapse whitespace for comparison."""
    return re.sub(r"[^a-z0-9]+", " ", name.lower()).strip()


def names_match(a: str, b: str) -> bool:
    """Whether two location names refer to the same place.

    Generic derived names (``"abandoned factory"``) are intentionally treated
    as non-matching so distinct nearby ruins are not merged on name alone.
    """
    na, nb = _normalize_name(a), _normalize_name(b)
    if not na or not nb:
        return False
    if na.startswith("abandoned ") or nb.startswith("abandoned "):
        return False
    return na == nb or na in nb or nb in na


def is_duplicate(a: RawLocation, b: RawLocation, radius_m: float) -> bool:
    """Whether `a` and `b` are the same site: close together and same-named."""
    distance = haversine_meters(a.lat, a.lng, b.lat, b.lng)
    if distance > radius_m:
        return False
    return names_match(a.name, b.name) or distance < 8.0


def dedupe(locations: list[RawLocation], radius_m: float = 60.0) -> list[RawLocation]:
    """Drop duplicate locations.

    A record with imagery is preferred over an otherwise-equivalent one
    without, so the kept set carries as much usable data as possible.
    """
    ordered = sorted(locations, key=lambda loc: loc.image_tag is None)
    kept: list[RawLocation] = []
    for loc in ordered:
        if not any(is_duplicate(loc, k, radius_m) for k in kept):
            kept.append(loc)
    return kept


def is_plausible(loc: RawLocation) -> bool:
    """Reject records with impossible coordinates or an empty name."""
    if not (-90.0 <= loc.lat <= 90.0) or not (-180.0 <= loc.lng <= 180.0):
        return False
    if loc.lat == 0.0 and loc.lng == 0.0:
        return False
    return bool(loc.name.strip())


def clean(locations: list[RawLocation], radius_m: float = 60.0) -> list[RawLocation]:
    """Full cleaning pass: drop implausible records, then deduplicate."""
    plausible = [loc for loc in locations if is_plausible(loc)]
    return dedupe(plausible, radius_m=radius_m)
