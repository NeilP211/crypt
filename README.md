<div align="center">

<img src="docs/images/crypt-logo.png" alt="Crypt" width="116" height="116" />

# Crypt

**Haunted places and urban exploration, by geospatial visual search.**

Upload a photo and uncover haunted, abandoned, and forgotten places across the
country, ranked by visual similarity, distance, and lore.

[![CI](https://github.com/NeilP211/crypt/actions/workflows/ci.yml/badge.svg)](https://github.com/NeilP211/crypt/actions/workflows/ci.yml)
&nbsp;·&nbsp; Rust · Next.js · PostGIS · CLIP · AWS

<br />

<img src="docs/images/demo.gif" alt="Crypt demo: drop a photo, get ranked haunted places on the map" width="840" />

</div>

---

## Why

Discovery for haunted spots and urban-exploration sites is gatekept,
scattered across private forums, Discord servers, and word of mouth, and the
tooling that exists is poor. Crypt is the search engine I wanted: point it at
a photo and it surfaces the eerily similar places, with location, type, and
the story behind each one.

## What it is

A full search platform built around a **vector index written from scratch in
Rust**. The pieces:

- A custom **HNSW** approximate-nearest-neighbor index, the hero component,
  benchmarked against exact kNN.
- **CLIP** embeddings over thousands of haunted/abandoned locations. CLIP is
  multimodal (image and text share one embedding space), so the index can be
  built from location *descriptions* and still answer *photo* queries.
- A **PostGIS** geospatial layer for radius, bounding-box, and distance
  queries.
- **Hybrid ranking** that blends vector similarity, geographic proximity, and
  metadata trust.
- An **axum** backend exposing both REST and gRPC, with JWT auth, Redis
  caching, and Prometheus metrics.
- A **Next.js + MapLibre** map frontend with drag-and-drop image search.
- Full **Terraform** AWS topology and a one-command local stack.

## Screenshots

<img src="docs/images/app-search.png" alt="Visual search results" width="100%" />

Drop a photo and Crypt returns ranked matches: numbered pins on the map and
scored results in the sidebar, blending visual similarity, distance, and lore.

| | |
|:--|:--|
| <img src="docs/images/app-detail.png" alt="Location detail panel" /> | <img src="docs/images/app-map.png" alt="Full-bleed haunted map" /> |
| Every place opens a detail card with a category illustration, the recorded haunting, and links to dig deeper. | Collapse the panel for a full-bleed map: gold gothic labels, crimson water, and teal location pins. |

## Highlights

| | |
|---|---|
| **Custom HNSW index** | recall@10 **97.2%** vs. exact kNN at **100k** vectors |
| **vs. FAISS** | within **1.2 pp** of FAISS HNSW at matched parameters |
| **Query latency** | **P99 4.9 ms** at 100k vectors, far under the 20 ms target |
| **Transports** | REST + gRPC over one shared search core |
| **Ranking** | hybrid vector + geospatial + metadata scoring |
| **Runs locally** | `docker compose up` boots the entire stack |
| **Tested** | 60 automated tests; CI across Rust, Python, web, Terraform, Docker |

Full methodology and the recall-vs-latency frontier:
[`benchmarks/REPORT.md`](benchmarks/REPORT.md).

## Architecture

```
                    ┌──────────────────────────────┐
   photo  ───────►  │  Next.js + MapLibre frontend  │
                    └───────────────┬──────────────┘
                          REST / gRPC │
                    ┌───────────────▼──────────────┐
                    │      crypt-server (axum)      │
                    │  auth · hybrid ranking · cache│
                    └───┬─────────┬─────────┬───────┘
              embed │   │  ANN    │  geo    │ cache
            ┌───────▼─┐ │ ┌───────▼──┐ ┌────▼────┐
            │  CLIP   │ │ │  PostGIS │ │  Redis  │
            │ service │ │ └──────────┘ └─────────┘
            └─────────┘ │
                  ┌─────▼──────┐
                  │ HNSW index │  ◄── built from scratch in Rust
                  └────────────┘
```

A request: photo → CLIP embedding → HNSW candidate lookup → PostGIS hydration
and distance → hybrid re-ranking → cached JSON. See
[`docs/architecture.md`](docs/architecture.md) for the full walkthrough.

## The hero: a from-scratch HNSW index

The `hnsw` crate implements the Hierarchical Navigable Small World algorithm
end to end: the layered proximity graph, the greedy layer descent, the
best-first beam search, and the neighbor-selection heuristic, with **no
third-party ANN dependency**.

![Recall vs latency frontier, and Crypt HNSW vs FAISS at matched parameters](docs/images/hnsw-benchmark.png)

Recall is measured against **brute-force exact kNN**, a stricter reference
than comparing two approximate libraries. At 100k clustered 128-d vectors
(modeling CLIP embedding structure), M = 24:

| ef_search | Recall@10 | P50 latency | P99 latency |
|-----------|-----------|-------------|-------------|
| 64        | 78.6%     | 0.6 ms      | 0.8 ms      |
| 128       | 85.6%     | 1.1 ms      | 1.5 ms      |
| 256       | 92.6%     | 2.2 ms      | 2.6 ms      |
| 512       | **97.2%** | 4.2 ms      | **4.9 ms**  |

Against **FAISS HNSW** at identical parameters on the same data, the
from-scratch index lands **within 1.2 percentage points** of recall, detailed in
[`benchmarks/FAISS_COMPARISON.md`](benchmarks/FAISS_COMPARISON.md).

The crate has property tests (retrievability, recall floor, persistence
round-trip), `criterion` micro-benchmarks, and a report generator.

## Tech stack

| Layer | Choice |
|-------|--------|
| Vector index | Custom HNSW in **Rust** |
| Embeddings | **CLIP** ViT-B/32 (`open_clip`) |
| Backend | **Rust**: axum (REST) + tonic (gRPC), sqlx |
| Database | **PostgreSQL + PostGIS** |
| Cache | **Redis** |
| Ingestion | **Python**: OpenStreetMap Overpass API |
| Frontend | **Next.js** + TypeScript + **MapLibre GL JS** |
| Auth | In-house JWT (Argon2id, access + refresh tokens) |
| Observability | OpenTelemetry Collector · Prometheus · Grafana |
| Infrastructure | **Terraform**: ECS Fargate, RDS, S3 + CloudFront |
| CI | GitHub Actions |

## Quickstart

Requires Docker.

```bash
# 1. Boot the whole stack (PostGIS, Redis, backend, embed service,
#    web, OTel Collector, Prometheus, Grafana).
make up

# 2. Load data: download the Haunted Places dataset, embed each location's
#    description with CLIP, build the index. (Downloads the CLIP model and,
#    via the Kaggle CLI, the dataset on first run.)
make ingest
```

Then open:

| URL | What |
|-----|------|
| http://localhost:3000 | Crypt web app |
| http://localhost:8080/api/health | Backend health |
| http://localhost:9090 | Prometheus |
| http://localhost:3001 | Grafana (service-overview dashboard) |

`make ingest` defaults to keeping all of North Carolina and capping other
states (`--boost-state`, `--per-state-cap`). For image-backed places from
OpenStreetMap + Wikidata instead, use `make ingest-osm`.

## Repository layout

```
crypt/
├── crates/
│   ├── hnsw/        from-scratch HNSW index + benchmark harness
│   ├── proto/       gRPC service definitions
│   └── server/      axum REST + gRPC backend
├── ingestion/       Python: OSM scraping, CLIP embedding, PostGIS loading
├── web/             Next.js + MapLibre frontend
├── infra/           Terraform AWS topology
├── deploy/          docker-compose + Dockerfiles
├── observability/   Prometheus, Grafana, OTel Collector configs
├── benchmarks/      recall-vs-latency report + FAISS comparison
└── docs/            architecture notes and ADRs
```

## Development

```bash
make test     # Rust + Python test suites
make lint     # clippy + eslint
make bench    # regenerate the HNSW benchmark report
```

CI runs the Rust suite (fmt, clippy, tests, benchmark smoke), the Python
ingestion tests, the web build, `terraform validate`, and a backend Docker
build on every push.

## Design decisions

Notable trade-offs are recorded as ADRs in [`docs/adr/`](docs/adr/):

1. [Implementing HNSW from scratch](docs/adr/0001-from-scratch-hnsw.md)
2. [MapLibre over Mapbox](docs/adr/0002-maplibre-over-mapbox.md)
3. [In-house authentication](docs/adr/0003-in-house-auth.md)

## About the dataset

Crypt is loaded from the **Shadowlands Haunted Places Index** (via the
[Kaggle dataset](https://www.kaggle.com/datasets/sujaykapadnis/haunted-places)):
~11k reported haunted and abandoned US locations: asylums, cemeteries, old
houses, ghost towns, mills, and ruins, each with coordinates and a written
account of its haunting. The ingestion pipeline also supports OpenStreetMap and
Wikidata sources (`--wikidata`) for image-backed places worldwide.

**Why a photo can search text.** The haunted dataset has descriptions, not
photos. Because CLIP encodes images and text into the *same* embedding space,
Crypt embeds each location's caption with CLIP's text encoder and your uploaded
photo with its image encoder, and compares them directly. So "visual search"
becomes "find places whose story matches what your photo looks like." The HNSW
index, PostGIS layer, and hybrid ranking are all unchanged.

**The North Carolina bias is intentional.** The ingest keeps every NC location
and caps every other state (`--boost-state`), so NC is the densest cluster on
the map. I'm from NC, and the earliest version of Crypt was something I used to
scout spots around home before opening it up to the rest of the country. The
concentration is a fossil of how the project started.

## Design

The visual identity (the candle icon, the teal / crimson / gold palette, and
the gothic type) is inspired by the **Crypt Candle**, an item from the game
Albion Online. It set the haunted, dungeon-lit tone the rest of the interface
follows.

## Notes

The AWS Terraform in `infra/` is real and `terraform validate`-clean, but is
not applied by this project: deploying it needs an AWS account and incurs
cost. Everything else runs locally with `docker compose`.

## License

MIT
