"""Command-line entry point that runs the full ingestion pipeline.

    crypt-ingest --region berlin --region detroit --limit 500

Stages: scrape OpenStreetMap, clean/deduplicate, resolve and download
imagery, embed with CLIP, write the flat embeddings file, and upsert into
PostGIS. After it finishes, build the index with:

    cargo run --release --bin build-index -- data/embeddings.bin data/crypt.index
"""

from __future__ import annotations

import argparse
import os
import sys

import requests

from . import clean, imagery, load, overpass

DEFAULT_DSN = "postgres://crypt:crypt@localhost:5432/crypt"


def _parse_bbox(raw: str) -> tuple[float, float, float, float]:
    parts = [float(x) for x in raw.split(",")]
    if len(parts) != 4:
        raise argparse.ArgumentTypeError("bbox must be 'south,west,north,east'")
    return parts[0], parts[1], parts[2], parts[3]


def _download(session: requests.Session, url: str, max_bytes: int = 8_000_000) -> bytes | None:
    """Download an image, returning `None` on any failure or non-image body."""
    try:
        response = session.get(
            url,
            timeout=30,
            headers={"User-Agent": "crypt-ingest/0.1 (+https://github.com/neilpatel/crypt)"},
        )
        response.raise_for_status()
    except requests.RequestException:
        return None
    if "image" not in response.headers.get("content-type", ""):
        return None
    if len(response.content) > max_bytes:
        return None
    return response.content


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="crypt-ingest", description="Ingest abandoned/historic locations into Crypt"
    )
    parser.add_argument(
        "--region",
        action="append",
        choices=sorted(overpass.REGIONS),
        help="a named region to scrape (repeatable)",
    )
    parser.add_argument(
        "--bbox", type=_parse_bbox, help="explicit bounding box 'south,west,north,east'"
    )
    parser.add_argument(
        "--limit", type=int, default=0, help="cap locations processed (0 = no cap)"
    )
    parser.add_argument(
        "--dsn", default=os.environ.get("DATABASE_URL", DEFAULT_DSN), help="PostgreSQL DSN"
    )
    parser.add_argument(
        "--embeddings-out", default="data/embeddings.bin", help="flat embeddings output path"
    )
    parser.add_argument("--skip-db", action="store_true", help="do not write to PostGIS")
    parser.add_argument(
        "--dry-run", action="store_true", help="scrape and clean only; no imagery or embeddings"
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_arg_parser().parse_args(argv)

    bboxes: list[tuple[float, float, float, float]] = []
    for region in args.region or []:
        bboxes.append(overpass.REGIONS[region])
    if args.bbox:
        bboxes.append(args.bbox)
    if not bboxes:
        bboxes = [overpass.REGIONS["berlin"]]

    # 1. Scrape OpenStreetMap.
    raw: list = []
    for bbox in bboxes:
        print(f"scraping Overpass for bbox {bbox} ...", file=sys.stderr)
        elements = overpass.fetch(bbox)
        raw.extend(overpass.parse_elements(elements))

    # 2. Clean and deduplicate.
    cleaned = clean.clean(raw)
    with_imagery = [loc for loc in cleaned if imagery.resolve_image_url(loc.image_tag)]
    print(
        f"scraped {len(raw)} -> cleaned {len(cleaned)} -> "
        f"with imagery {len(with_imagery)}",
        file=sys.stderr,
    )
    if args.dry_run:
        for loc in with_imagery[:20]:
            print(f"  {loc.name} [{loc.era}/{loc.structure_type}] {loc.lat:.4f},{loc.lng:.4f}")
        return 0

    candidates = with_imagery[: args.limit] if args.limit else with_imagery

    # 3. Download imagery and embed with CLIP.
    from .embed import Embedder  # lazy: avoids importing torch unless needed

    embedder = Embedder()
    session = requests.Session()
    kept: list = []
    vectors: list = []
    for loc in candidates:
        url = imagery.resolve_image_url(loc.image_tag)
        data = _download(session, url) if url else None
        if data is None:
            continue
        try:
            vector = embedder.embed_bytes(data)
        except Exception as error:  # noqa: BLE001 - skip any unreadable image
            print(f"  embed failed for {loc.source_id}: {error}", file=sys.stderr)
            continue
        loc.image_url = url
        loc.embedding_id = len(kept)
        kept.append(loc)
        vectors.append(vector)
        if len(kept) % 25 == 0:
            print(f"  embedded {len(kept)} locations", file=sys.stderr)

    if not kept:
        print("no locations had usable imagery — nothing to load", file=sys.stderr)
        return 1

    # 4. Write the flat embeddings file.
    import numpy as np

    matrix = np.vstack(vectors)
    out_dir = os.path.dirname(args.embeddings_out)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)
    load.write_embeddings_file(args.embeddings_out, matrix)
    print(
        f"wrote {len(kept)} embeddings (dim {matrix.shape[1]}) to {args.embeddings_out}",
        file=sys.stderr,
    )

    # 5. Upsert into PostGIS.
    if not args.skip_db:
        count = load.load_into_postgis(args.dsn, kept)
        print(f"loaded {count} locations into PostGIS", file=sys.stderr)

    print(
        "done — build the index with:\n"
        f"  cargo run --release --bin build-index -- {args.embeddings_out} data/crypt.index"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
