"""Wikidata as a global, image-backed source of urbex and historic locations.

OpenStreetMap rarely carries usable image tags, so for worldwide coverage we
query Wikidata's SPARQL endpoint for ruins, ghost towns, archaeological sites,
and (region-scoped) historic structures that have both coordinates (P625) and
an image (P18). Wikidata's images are Wikimedia Commons files, served directly
via `Special:FilePath`.
"""

from __future__ import annotations

from .model import RawLocation

WDQS_ENDPOINT = "https://query.wikidata.org/sparql"
_USER_AGENT = "crypt-ingest/0.1 (+https://github.com/NeilP211/crypt)"

# Urbex-flavored Wikidata classes: ruins, ghost town, archaeological site,
# and abandoned village.
_GLOBAL_TYPES = ("wd:Q109607", "wd:Q3010369", "wd:Q839954", "wd:Q2649110")

# Keyword -> structure_type, scanned against the (English) label.
_STRUCTURE_KEYWORDS: tuple[tuple[tuple[str, ...], str], ...] = (
    (("castle", "fort", "fortress", "citadel", "bastion"), "castle"),
    (("church", "chapel", "cathedral", "abbey", "monastery", "priory", "temple", "synagogue"), "religious"),
    (("hospital", "asylum", "sanatorium", "sanitarium", "infirmary"), "hospital"),
    (("factory", "mill", "works", "foundry", "plant", "refinery", "warehouse", "brewery"), "factory"),
    (("station", "depot", "railway", "railroad", "roundhouse"), "rail"),
    (("mine", "colliery", "quarry", "mineshaft"), "mine"),
    (("bunker", "armory", "arsenal", "barracks", "battery", "military"), "military"),
    (("house", "mansion", "hall", "manor", "plantation", "homestead", "cottage"), "residential"),
    (("ruins", "ruin"), "ruins"),
)


def _query(sparql: str) -> list[dict]:
    """Run a SPARQL query against WDQS and return the result bindings."""
    import requests

    response = requests.get(
        WDQS_ENDPOINT,
        params={"query": sparql, "format": "json"},
        headers={
            "User-Agent": _USER_AGENT,
            "Accept": "application/sparql-results+json",
        },
        timeout=90,
    )
    response.raise_for_status()
    return response.json()["results"]["bindings"]


def classify_structure(label: str) -> str:
    """Best-effort structure type from keywords in the label."""
    lowered = label.lower()
    for keywords, structure_type in _STRUCTURE_KEYWORDS:
        if any(keyword in lowered for keyword in keywords):
            return structure_type
    return "unknown"


def _thumb(image_url: str) -> str:
    """Turn a Commons FilePath URL into an HTTPS 800px thumbnail request."""
    url = image_url.replace("http://", "https://", 1)
    separator = "&" if "?" in url else "?"
    return f"{url}{separator}width=800"


def parse_bindings(bindings: list[dict]) -> list[RawLocation]:
    """Convert SPARQL result bindings into `RawLocation`s.

    Pure and offline-testable; the network lives only in `_query`.
    """
    locations: list[RawLocation] = []
    for binding in bindings:
        try:
            lat = float(binding["lat"]["value"])
            lon = float(binding["lon"]["value"])
        except (KeyError, ValueError):
            continue
        name = binding.get("itemLabel", {}).get("value", "").strip()
        image = binding.get("image", {}).get("value")
        if not name or not image:
            continue
        qid = binding["item"]["value"].rsplit("/", 1)[-1]
        locations.append(
            RawLocation(
                source_id=qid,
                name=name,
                description="",
                lat=lat,
                lng=lon,
                era="unknown",
                structure_type=classify_structure(name),
                image_tag=_thumb(image),
                tags={"source": "wikidata"},
            )
        )
    return locations


def fetch_global(limit: int = 150) -> list[RawLocation]:
    """Worldwide urbex sites (ruins, ghost towns, archaeological sites)."""
    types = " ".join(_GLOBAL_TYPES)
    sparql = f"""
SELECT ?item ?itemLabel ?lat ?lon ?image WHERE {{
  VALUES ?type {{ {types} }}
  ?item wdt:P31 ?type ; wdt:P18 ?image ; p:P625 ?st .
  ?st psv:P625 ?cv . ?cv wikibase:geoLatitude ?lat ; wikibase:geoLongitude ?lon .
  ?item rdfs:label ?itemLabel . FILTER(LANG(?itemLabel) = "en")
}} LIMIT {int(limit)}
"""
    return parse_bindings(_query(sparql))


def fetch_in_bbox(
    south: float,
    west: float,
    north: float,
    east: float,
    limit: int = 250,
) -> list[RawLocation]:
    """Image-backed places within a lat/lng box.

    Uses Wikidata's spatial `wikibase:box` service (geo-indexed, fast) instead
    of the expensive transitive ``located in`` relation, which times out for
    large regions.
    """
    sparql = f"""
SELECT ?item ?itemLabel ?lat ?lon ?image WHERE {{
  SERVICE wikibase:box {{
    ?item wdt:P625 ?loc .
    bd:serviceParam wikibase:cornerSouthWest "Point({west} {south})"^^geo:wktLiteral .
    bd:serviceParam wikibase:cornerNorthEast "Point({east} {north})"^^geo:wktLiteral .
  }}
  ?item wdt:P18 ?image .
  BIND(geof:latitude(?loc) AS ?lat)
  BIND(geof:longitude(?loc) AS ?lon)
  ?item rdfs:label ?itemLabel . FILTER(LANG(?itemLabel) = "en")
}} LIMIT {int(limit)}
"""
    return parse_bindings(_query(sparql))


# North Carolina bounding box (south, west, north, east); the west/south
# edges are kept just inside the state line to exclude Atlanta.
NORTH_CAROLINA_BBOX = (33.85, -84.1, 36.6, -75.4)
