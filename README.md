<div align="center">

# Crypt

**Geospatial visual search for urban exploration.**

Upload a photo of a place you like — get visually similar abandoned and
historic locations near you, ranked by image similarity, distance, and
metadata.

[![CI](https://github.com/NeilP211/crypt/actions/workflows/ci.yml/badge.svg)](https://github.com/NeilP211/crypt/actions/workflows/ci.yml)
&nbsp;·&nbsp; Rust · Next.js · PostGIS · CLIP · AWS

</div>

---

## Why

Location discovery for urban exploration is gatekept — scattered across
private forums, Discord servers, and word of mouth — and the tooling that
does exist is poor. Crypt is the search engine I wanted: point it at a photo
of an abandoned factory and it finds you the visually similar ones nearby,
with era, structure type, and last-verified status attached.

## What it is

A full search platform built around a **vector index written from scratch in
Rust**. The pieces:

- A custom **HNSW** approximate-nearest-neighbor index — the hero component —
  benchmarked against exact kNN.
- **CLIP** image embeddings over real **OpenStreetMap** abandoned/historic
  locations.
- A **PostGIS** geospatial layer for radius, bounding-box, and distance
  queries.
- **Hybrid ranking** that blends vector similarity, geographic proximity, and
  metadata trust.
- An **axum** backend exposing both REST and gRPC, with JWT auth, Redis
  caching, and Prometheus metrics.
- A **Next.js + MapLibre** map frontend with drag-and-drop image search.
- Full **Terraform** AWS topology and a one-command local stack.

## Highlights

| | |
|---|---|
| **Custom HNSW index** | recall@10 **97.2%** vs. exact kNN at **100k** vectors |
| **vs. FAISS** | within **1.2 pp** of FAISS HNSW at matched parameters |
| **Query latency** | **P99 4.9 ms** at 100k vectors — far under the 20 ms target |
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
end to end — the layered proximity graph, the greedy layer descent, the
best-first beam search, and the neighbor-selection heuristic — with **no
third-party ANN dependency**.

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
from-scratch index lands **within 1.2 percentage points** of recall —
[`benchmarks/FAISS_COMPARISON.md`](benchmarks/FAISS_COMPARISON.md).

The crate has property tests (retrievability, recall floor, persistence
round-trip), `criterion` micro-benchmarks, and a report generator.

## Tech stack

| Layer | Choice |
|-------|--------|
| Vector index | Custom HNSW in **Rust** |
| Embeddings | **CLIP** ViT-B/32 (`open_clip`) |
| Backend | **Rust** — axum (REST) + tonic (gRPC), sqlx |
| Database | **PostgreSQL + PostGIS** |
| Cache | **Redis** |
| Ingestion | **Python** — OpenStreetMap Overpass API |
| Frontend | **Next.js** + TypeScript + **MapLibre GL JS** |
| Auth | In-house JWT (Argon2id, access + refresh tokens) |
| Observability | OpenTelemetry Collector · Prometheus · Grafana |
| Infrastructure | **Terraform** — ECS Fargate, RDS, S3 + CloudFront |
| CI | GitHub Actions |

## Quickstart

Requires Docker.

```bash
# 1. Boot the whole stack (PostGIS, Redis, backend, embed service,
#    web, OTel Collector, Prometheus, Grafana).
make up

# 2. Ingest real data: scrape OpenStreetMap, embed with CLIP,
#    build the index. (Downloads the CLIP model on first run.)
make ingest REGION=berlin LIMIT=800
```

Then open:

| URL | What |
|-----|------|
| http://localhost:3000 | Crypt web app |
| http://localhost:8080/api/health | Backend health |
| http://localhost:9090 | Prometheus |
| http://localhost:3001 | Grafana (service-overview dashboard) |

Available regions: `berlin`, `detroit`, `paris`, `nyc`, `london`, `rome` —
or pass `--bbox`.

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

Crypt's locations are sourced from public data (OpenStreetMap, Wikidata) —
abandoned, ruined, and historically interesting sites worldwide.

The map skews heavily toward **North Carolina**. That's on purpose: I'm from
NC, and the earliest version of Crypt was something I actually used to scout
urban-exploration spots around home before opening it up to the rest of the
world. The concentration there is a fossil of how the project started.

## Notes

The AWS Terraform in `infra/` is real and `terraform validate`-clean, but is
not applied by this project — deploying it needs an AWS account and incurs
cost. Everything else runs locally with `docker compose`.

## License

MIT
