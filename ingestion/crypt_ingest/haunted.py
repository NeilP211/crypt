"""Load the Shadowlands Haunted Places dataset (Kaggle:
``sujaykapadnis/haunted-places``) into `RawLocation`s.

These ~22k US locations have coordinates and a written description but no
image, so they are embedded with CLIP's *text* encoder (see `embed.py`) rather
than downloaded photos. CSV columns: city, country, description, location,
state, state_abbrev, longitude, latitude, city_longitude, city_latitude.
"""

from __future__ import annotations

import csv

from .model import RawLocation
from .wikidata import classify_structure


def _coordinate(row: dict, primary: str, fallback: str) -> float | None:
    """Parse a coordinate, falling back to the city-level value."""
    for key in (primary, fallback):
        value = (row.get(key) or "").strip()
        if value:
            try:
                return float(value)
            except ValueError:
                continue
    return None


def caption(loc: RawLocation, max_chars: int = 240) -> str:
    """Build the text fed to CLIP: name + place, then a description snippet.

    The name usually carries the visual type (Cemetery, Asylum, House,
    Lighthouse), which is what an image query can actually match against.
    """
    place = ", ".join(
        part for part in (loc.tags.get("city"), loc.tags.get("state")) if part
    )
    head = f"{loc.name}, {place}" if place else loc.name
    text = f"{head}. {loc.description}".strip() if loc.description else head
    return text[:max_chars]


def parse_rows(rows: list[dict]) -> list[RawLocation]:
    """Convert CSV rows into `RawLocation`s, dropping rows without a name or
    usable coordinates."""
    locations: list[RawLocation] = []
    for row in rows:
        name = (row.get("location") or "").strip()
        lat = _coordinate(row, "latitude", "city_latitude")
        lng = _coordinate(row, "longitude", "city_longitude")
        if not name or lat is None or lng is None:
            continue
        city = (row.get("city") or "").strip()
        state = (row.get("state") or "").strip()
        locations.append(
            RawLocation(
                source_id=f"{state}/{city}/{name}"[:240],
                name=name,
                description=(row.get("description") or "").strip(),
                lat=lat,
                lng=lng,
                era="unknown",
                structure_type=classify_structure(name),
                image_tag=None,
                tags={"city": city, "state": state, "source": "shadowlands"},
            )
        )
    return locations


def load(path: str) -> list[RawLocation]:
    """Read the Haunted Places CSV from disk."""
    with open(path, encoding="utf-8", errors="replace", newline="") as handle:
        rows = list(csv.DictReader(handle))
    return parse_rows(rows)
