"""OpenStreetMap Overpass API scraping for abandoned and historic places.

The Overpass API is free and needs no key. We query for the tag families that
mark a place as abandoned, ruined, disused, or historically notable, then
classify each result into an era and a structure type from its tags.
"""

from __future__ import annotations

import re
import time
from typing import TYPE_CHECKING

from .model import RawLocation

if TYPE_CHECKING:
    import requests

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# Overpass rejects requests with the default `python-requests` user agent
# (HTTP 406), so identify the client explicitly.
_USER_AGENT = "crypt-ingest/0.1 (+https://github.com/neilpatel/crypt)"

# A few ready-made bounding boxes (south, west, north, east) for the CLI.
REGIONS: dict[str, tuple[float, float, float, float]] = {
    "berlin": (52.34, 13.09, 52.68, 13.76),
    "detroit": (42.25, -83.29, 42.45, -82.91),
    "paris": (48.75, 2.22, 48.91, 2.47),
    "nyc": (40.50, -74.26, 40.92, -73.70),
    "london": (51.38, -0.35, 51.62, 0.15),
    "rome": (41.79, 12.34, 42.00, 12.62),
}


def build_query(bbox: tuple[float, float, float, float], timeout: int = 120) -> str:
    """Build an Overpass QL query for abandoned/historic features in a bbox."""
    south, west, north, east = bbox
    box = f"({south},{west},{north},{east})"
    selectors = [
        '["historic"]',
        '["abandoned"="yes"]',
        '["ruins"="yes"]',
        '["building"="ruins"]',
        '["disused"="yes"]',
        '["abandoned:building"]',
        '["abandoned:amenity"]',
    ]
    body = "\n  ".join(f"nwr{sel}{box};" for sel in selectors)
    return f"[out:json][timeout:{timeout}];\n(\n  {body}\n);\nout center tags;"


def fetch(
    bbox: tuple[float, float, float, float],
    *,
    session: requests.Session | None = None,
    retries: int = 3,
) -> list[dict]:
    """Run an Overpass query and return the raw element list.

    Overpass is a shared public resource; transient errors — rate limits,
    gateway timeouts, and read timeouts on heavy queries — are retried with a
    backoff.
    """
    import requests

    session = session or requests.Session()
    query = build_query(bbox, timeout=240)
    headers = {"User-Agent": _USER_AGENT}
    last_error: Exception | None = None
    for attempt in range(retries):
        try:
            response = session.post(
                OVERPASS_URL, data={"data": query}, headers=headers, timeout=300
            )
        except requests.exceptions.RequestException as error:
            last_error = error
            time.sleep(5 * (attempt + 1))
            continue
        if response.status_code in (429, 503, 504):
            last_error = RuntimeError(f"HTTP {response.status_code}")
            time.sleep(5 * (attempt + 1))
            continue
        response.raise_for_status()
        return response.json().get("elements", [])
    raise RuntimeError(
        f"Overpass API request failed after {retries} retries: {last_error}"
    )


def _coords(element: dict) -> tuple[float | None, float | None]:
    """Extract a representative (lat, lng) from a node or way/relation."""
    if "lat" in element and "lon" in element:
        return element["lat"], element["lon"]
    center = element.get("center")
    if center:
        return center.get("lat"), center.get("lon")
    return None, None


def _year_from_tags(tags: dict) -> int | None:
    """Best-effort construction year from date-bearing tags."""
    for key in ("start_date", "year", "building:year", "construction_date"):
        value = tags.get(key)
        if value:
            match = re.search(r"\b(1[0-9]{3}|20[0-2][0-9])\b", str(value))
            if match:
                return int(match.group(1))
    return None


def classify_era(tags: dict) -> str:
    """Classify a feature's era from its construction date or tag hints."""
    year = _year_from_tags(tags)
    if year is not None:
        if year < 1840:
            return "pre-industrial"
        if year < 1914:
            return "industrial"
        if year < 1945:
            return "wartime"
        if year < 1980:
            return "mid-century"
        return "modern"

    historic = tags.get("historic", "")
    if historic in ("castle", "fort", "ruins", "archaeological_site", "monastery"):
        return "pre-industrial"
    if historic == "bunker" or "military" in tags or "abandoned:military" in tags:
        return "wartime"
    return "unknown"


def classify_structure(tags: dict) -> str:
    """Classify a feature's structure type from its tags."""
    historic = tags.get("historic", "")
    building = tags.get("building", "")
    man_made = tags.get("man_made", "")
    amenity = tags.get("amenity", "")

    if historic in ("castle", "fort", "city_gate") or building == "castle":
        return "castle"
    if historic in ("church", "monastery", "chapel", "cathedral") or building in (
        "church",
        "chapel",
        "cathedral",
        "monastery",
    ):
        return "religious"
    if (
        building in ("hospital", "asylum")
        or amenity == "hospital"
        or "hospital" in tags.get("abandoned:amenity", "")
    ):
        return "hospital"
    if building in ("industrial", "factory", "warehouse") or man_made in (
        "works",
        "factory",
    ):
        return "factory"
    if building in ("house", "residential", "apartments", "hotel"):
        return "residential"
    if (
        "railway" in tags
        or building in ("train_station", "station")
        or "abandoned:railway" in tags
    ):
        return "rail"
    if (
        man_made == "mineshaft"
        or historic == "mine"
        or tags.get("abandoned:landuse") == "quarry"
    ):
        return "mine"
    if historic == "bunker" or "military" in tags or "abandoned:military" in tags:
        return "military"
    if historic in ("ruins", "archaeological_site"):
        return "ruins"
    return "unknown"


def classify_verified(tags: dict) -> str:
    """Derive a verification status from survey/condition tags."""
    if (
        tags.get("demolished")
        or tags.get("razed")
        or tags.get("demolished:building")
        or tags.get("was:building")
    ):
        return "demolished"
    if tags.get("check_date") or tags.get("survey:date"):
        return "verified"
    return "unverified"


def _name(tags: dict, structure_type: str) -> str:
    """Pick a human name for a feature, deriving a generic one if untagged."""
    for key in ("name", "name:en", "old_name", "official_name"):
        if tags.get(key):
            return tags[key].strip()
    label = structure_type if structure_type != "unknown" else "site"
    return f"Abandoned {label}"


def parse_element(element: dict) -> RawLocation | None:
    """Convert one Overpass element into a `RawLocation`, or `None` if it
    lacks usable coordinates."""
    lat, lng = _coords(element)
    if lat is None or lng is None:
        return None
    tags = element.get("tags", {})
    structure_type = classify_structure(tags)
    return RawLocation(
        source_id=f"{element.get('type', 'node')}/{element.get('id', 0)}",
        name=_name(tags, structure_type),
        description=tags.get("description", "") or tags.get("inscription", ""),
        lat=float(lat),
        lng=float(lng),
        era=classify_era(tags),
        structure_type=structure_type,
        image_tag=tags.get("image") or tags.get("wikimedia_commons"),
        tags=tags,
        verified_status=classify_verified(tags),
    )


def parse_elements(elements: list[dict]) -> list[RawLocation]:
    """Parse every Overpass element, dropping those without coordinates."""
    parsed = (parse_element(el) for el in elements)
    return [loc for loc in parsed if loc is not None]
