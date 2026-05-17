"""Loading: the flat embeddings file and PostGIS inserts.

The embeddings file is a language-neutral binary the Rust ``build-index``
binary consumes:

    [u32 count][u32 dim][f32 ...]   little-endian, row-major

Vector row ``i`` corresponds to ``locations.embedding_id = i``.
"""

from __future__ import annotations

import struct

import numpy as np

from .model import RawLocation


def write_embeddings_file(path: str, vectors: np.ndarray) -> None:
    """Write a 2-D float array to the flat embeddings format."""
    if vectors.ndim != 2:
        raise ValueError(f"expected a 2-D array, got shape {vectors.shape}")
    count, dim = vectors.shape
    contiguous = np.ascontiguousarray(vectors, dtype="<f4")
    with open(path, "wb") as handle:
        handle.write(struct.pack("<II", count, dim))
        handle.write(contiguous.tobytes())


def read_embeddings_file(path: str) -> np.ndarray:
    """Read the flat embeddings format back into a 2-D float array."""
    with open(path, "rb") as handle:
        header = handle.read(8)
        count, dim = struct.unpack("<II", header)
        body = np.frombuffer(handle.read(), dtype="<f4")
    if body.size != count * dim:
        raise ValueError("embeddings file body does not match its header")
    return body.reshape(count, dim)


_INSERT_SQL = """
INSERT INTO locations
    (embedding_id, name, description, geom, era, structure_type,
     verified_status, image_url, source, source_id)
VALUES
    (%(embedding_id)s, %(name)s, %(description)s,
     ST_SetSRID(ST_MakePoint(%(lng)s, %(lat)s), 4326)::geography,
     %(era)s, %(structure_type)s, %(verified_status)s, %(image_url)s,
     'osm', %(source_id)s)
ON CONFLICT (source, source_id) WHERE source_id IS NOT NULL
DO UPDATE SET
    embedding_id = EXCLUDED.embedding_id,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    geom = EXCLUDED.geom,
    era = EXCLUDED.era,
    structure_type = EXCLUDED.structure_type,
    image_url = EXCLUDED.image_url
"""


def _to_row(loc: RawLocation) -> dict:
    return {
        "embedding_id": loc.embedding_id,
        "name": loc.name,
        "description": loc.description,
        "lng": loc.lng,
        "lat": loc.lat,
        "era": loc.era,
        "structure_type": loc.structure_type,
        "verified_status": loc.verified_status,
        "image_url": loc.image_url or "",
        "source_id": loc.source_id,
    }


def load_into_postgis(dsn: str, locations: list[RawLocation]) -> int:
    """Upsert locations into PostGIS. Returns the number of rows written.

    Existing rows (matched by ``source_id``) are updated, so re-running
    ingestion refreshes the dataset rather than duplicating it.
    """
    import psycopg

    rows = [_to_row(loc) for loc in locations]
    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            cur.executemany(_INSERT_SQL, rows)
        conn.commit()
    return len(rows)
