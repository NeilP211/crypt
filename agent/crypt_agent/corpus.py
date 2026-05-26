"""The Crypt corpus: real haunted and abandoned places with lore text.

Source is the Shadowlands Haunted Places dataset (Kaggle
``sujaykapadnis/haunted-places``): ~22k US locations, each with a name, a
written description of the haunting, a city/state, and coordinates. We
normalize it into a flat ``corpus.jsonl`` the retrieval layer can load with
no database running.

Run ``python -m crypt_agent.cli build-corpus`` to (re)build it.
"""

from __future__ import annotations

import csv
import json
import re
from dataclasses import asdict, dataclass
from pathlib import Path

from .config import CORPUS_PATH

# Lightweight structure classifier (mirrors the ingestion buckets) so each
# place carries a filterable category without a model call.
_STRUCTURE_PATTERNS: list[tuple[str, str]] = [
    ("cemetery|graveyard|burial|tomb|mausoleum", "cemetery"),
    ("asylum|sanitarium|sanatorium|hospital|infirmary", "hospital"),
    ("church|chapel|cathedral|abbey|monastery|convent", "religious"),
    ("school|college|university|academy", "school"),
    ("theater|theatre|opera|cinema", "theater"),
    ("hotel|inn|motel|tavern|saloon|pub", "hotel"),
    ("bridge|tunnel|road|highway|railroad|rail", "infrastructure"),
    ("fort|military|prison|jail|penitentiary", "military"),
    ("mill|factory|mine|plant|foundry", "industrial"),
    ("lighthouse|fort|castle|mansion|manor", "landmark"),
    ("house|home|residence|farm|estate", "residential"),
]


def classify_structure(name: str) -> str:
    lowered = name.lower()
    for pattern, label in _STRUCTURE_PATTERNS:
        if re.search(pattern, lowered):
            return label
    return "unknown"


@dataclass
class Place:
    """One corpus record. ``id`` is the stable retrieval key."""

    id: int
    name: str
    city: str
    state: str
    description: str
    lat: float
    lng: float
    structure_type: str

    def document(self) -> str:
        """The text shown to the retriever and the LLM."""
        place = ", ".join(p for p in (self.city, self.state) if p)
        head = f"{self.name} ({place})" if place else self.name
        body = self.description.strip() or "No recorded description."
        return f"{head}. {body}"

    def citation(self) -> str:
        place = ", ".join(p for p in (self.city, self.state) if p)
        return f"[{self.id}] {self.name}, {place}" if place else f"[{self.id}] {self.name}"


def _coord(row: dict, primary: str, fallback: str) -> float | None:
    for key in (primary, fallback):
        raw = (row.get(key) or "").strip()
        if raw:
            try:
                return float(raw)
            except ValueError:
                continue
    return None


def parse_csv(path: str | Path) -> list[Place]:
    """Parse the Haunted Places CSV into corpus records."""
    places: list[Place] = []
    with open(path, encoding="utf-8", errors="replace", newline="") as handle:
        for i, row in enumerate(csv.DictReader(handle)):
            name = (row.get("location") or "").strip()
            lat = _coord(row, "latitude", "city_latitude")
            lng = _coord(row, "longitude", "city_longitude")
            description = (row.get("description") or "").strip()
            # Need a name, a location, and at least a sentence of lore.
            if not name or lat is None or lng is None or len(description) < 20:
                continue
            places.append(
                Place(
                    id=len(places),
                    name=name,
                    city=(row.get("city") or "").strip(),
                    state=(row.get("state") or "").strip(),
                    description=description,
                    lat=lat,
                    lng=lng,
                    structure_type=classify_structure(name),
                )
            )
    return places


def download_csv() -> Path:
    """Fetch the Haunted Places CSV from Kaggle (token read from env)."""
    import kagglehub

    root = Path(kagglehub.dataset_download("sujaykapadnis/haunted-places"))
    for candidate in root.rglob("*.csv"):
        return candidate
    raise FileNotFoundError(f"no CSV found under {root}")


def build_corpus(csv_path: str | Path | None = None, limit: int | None = None) -> list[Place]:
    """Build ``corpus.jsonl`` from the real dataset and return the records."""
    source = Path(csv_path) if csv_path else download_csv()
    places = parse_csv(source)
    if limit:
        places = places[:limit]
        for new_id, place in enumerate(places):
            place.id = new_id
    write_corpus(places)
    return places


def write_corpus(places: list[Place], path: Path = CORPUS_PATH) -> None:
    with open(path, "w", encoding="utf-8") as handle:
        for place in places:
            handle.write(json.dumps(asdict(place)) + "\n")


def load_corpus(path: Path = CORPUS_PATH) -> list[Place]:
    if not path.exists():
        raise FileNotFoundError(
            f"{path} missing. Run: python -m crypt_agent.cli build-corpus"
        )
    places: list[Place] = []
    with open(path, encoding="utf-8") as handle:
        for line in handle:
            if line.strip():
                places.append(Place(**json.loads(line)))
    return places
