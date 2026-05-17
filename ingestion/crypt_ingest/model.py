"""Shared data types for the ingestion pipeline."""

from __future__ import annotations

from dataclasses import dataclass, field

# The era buckets a location can be classified into.
ERA_BUCKETS = (
    "pre-industrial",
    "industrial",
    "wartime",
    "mid-century",
    "modern",
    "unknown",
)

# The structure-type buckets a location can be classified into.
STRUCTURE_BUCKETS = (
    "castle",
    "religious",
    "hospital",
    "factory",
    "residential",
    "rail",
    "mine",
    "military",
    "ruins",
    "unknown",
)


@dataclass
class RawLocation:
    """A location as scraped from OpenStreetMap, before imagery + embedding."""

    source_id: str
    name: str
    description: str
    lat: float
    lng: float
    era: str
    structure_type: str
    image_tag: str | None
    tags: dict = field(default_factory=dict)
    verified_status: str = "unverified"

    # Populated later in the pipeline.
    image_url: str | None = None
    embedding_id: int | None = None
