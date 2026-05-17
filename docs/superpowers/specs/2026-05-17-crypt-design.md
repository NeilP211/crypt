# Crypt — Geospatial Vector Search for Urban Exploration

**Design spec — 2026-05-17**

## 1. Summary

Crypt is a search engine for abandoned and historically interesting locations.
A user uploads a photo of a place they like and gets back visually similar
locations near them, each with metadata (era, structure type, last-verified
status). The system combines a from-scratch HNSW vector index (Rust), CLIP image
embeddings, and a PostGIS geospatial layer behind a hybrid ranking function.

The from-scratch **HNSW index in Rust is the hero component** and the primary
resume signal. Everything else exists to give that index a real, end-to-end
home: a real dataset, a real API, a real map frontend.

### Goals

- A clone-and-run repository: `docker-compose up` boots the entire stack.
- A genuinely benchmarked custom HNSW index with a written recall-vs-latency
  report containing real numbers.
- Real data: locations scraped from OpenStreetMap, real CLIP embeddings.
- Production-grade structure recruiters can read top-to-bottom: clean module
  boundaries, tests, CI, IaC, observability.

### Non-goals

- Live AWS deployment. Terraform is written and `terraform validate`-clean but
  not applied (requires the owner's AWS account and incurs cost).
- A managed-auth integration (Clerk/Supabase). Auth is built in-house.
- Exhaustive global coverage. Launch target is a meaningful regional dataset,
  not all 10k+ locations worldwide.

## 2. Decisions

| Area | Decision | Rationale |
|------|----------|-----------|
| Map | MapLibre GL JS, not Mapbox GL JS | Open-source fork, same API, no secret token — repo clones and runs. |
| Auth | In-house JWT (argon2 + access/refresh tokens) | Self-contained stack; stronger SWE signal than wiring a SaaS. |
| Embeddings | `open_clip` ViT-B/32 run locally | Real embeddings, no GPU service dependency. Modal script included as documented scale-out path. |
| Data source | OpenStreetMap Overpass API | Free, no key, genuinely real abandoned/ruined/historic locations. |
| AWS | Terraform, validated not applied | Cost and account ownership; IaC is still a real artifact. |
| Frontend | Next.js App Router + TypeScript | Matches resume bullet; modern, recruiter-legible. |

## 3. Architecture

Rust monorepo (Cargo workspace) plus a Python ingestion package and a Next.js
app, all under `~/projects/crypt/`.

```
crypt/
  crates/
    hnsw/         from-scratch HNSW index (library crate) — HERO
    server/       axum REST + tonic gRPC backend
    proto/        gRPC service + message definitions
  ingestion/      Python: OSM scrape -> CLIP embed -> PostGIS + index build
  web/            Next.js + TypeScript + MapLibre frontend
  infra/          Terraform: ECS, RDS+PostGIS, S3+CloudFront, IAM, Route53/ACM
  deploy/         docker-compose full local stack + Dockerfiles
  observability/  Prometheus config, Grafana dashboards, OTel collector config
  benchmarks/     recall-vs-latency benchmark report (real numbers)
  docs/           architecture notes, ADRs, benchmark report
  .github/workflows/   CI: rust test/clippy/bench, python lint, web build
  README.md       recruiter-facing front door
```

### Data flow

**Ingestion (offline, `make ingest`):**
OSM Overpass query → location records → fetch linked Wikimedia Commons imagery →
batched CLIP embeddings → dedup + clean → write rows to PostGIS → build HNSW
index → persist index to disk.

**Query (online):**
Client uploads image → `server` embeds it via the embedding service → HNSW ANN
search returns candidate location IDs + similarity scores → PostGIS filters
candidates by radius and metadata → hybrid ranker blends scores → Redis caches
the result → JSON/gRPC response → MapLibre renders pins + result cards.

## 4. Components

### 4.1 `crates/hnsw` — the hero

A from-scratch Hierarchical Navigable Small World graph index. No external ANN
dependency.

- **Graph structure:** multi-layer graph; configurable `M` (max neighbors),
  `ef_construction`, `ef_search`. Layer assignment by exponential decay.
- **Search:** greedy layer descent + best-first search on layer 0 with a
  candidate heap; neighbor-selection heuristic for graph quality.
- **Metrics:** cosine and L2 (CLIP uses cosine on normalized vectors).
- **Persistence:** serialize/deserialize index to/from disk.
- **Correctness:** `proptest` property tests — every inserted vector is
  retrievable; recall stays above a threshold on random data; persistence
  round-trips.
- **Benchmarks:** a harness that computes **recall@k against brute-force exact
  kNN ground truth** at 100k vectors, plus `criterion` micro-benchmarks for
  query latency (target: sub-20ms P99) and index build time.
- **Output:** a generated benchmark report committed to `benchmarks/`.

Public surface: `Index::new(config)`, `insert`, `search`, `save`, `load`. The
crate has no dependency on the rest of the workspace.

### 4.2 `crates/server` — axum backend

- **Transport:** REST (axum) + gRPC (tonic). Shared service layer underneath.
- **Search service:** owns the in-process HNSW index; exposes
  image-similarity and id-similarity search.
- **Hybrid ranking:** final score is a normalized weighted blend of
  (a) vector similarity, (b) geographic proximity via PostGIS
  `ST_DWithin`/`ST_Distance`, (c) metadata filter match (era, structure type,
  verified status). Weights are configurable.
- **Persistence:** PostGIS via `sqlx`; migrations checked in.
- **Auth:** registration/login, argon2id password hashing, JWT access tokens +
  refresh tokens, auth middleware.
- **User features:** saved locations, contributor submission flow (submit a new
  location for review).
- **Caching:** Redis for hot query results, keyed by query hash.
- **Observability:** OpenTelemetry traces exported to the OTel collector;
  Prometheus metrics on `/metrics` (request latency histograms, search latency,
  cache hit rate, index size).

### 4.3 `crates/proto` — gRPC contracts

`.proto` definitions for the search service, compiled with `tonic-build`.

### 4.4 `ingestion/` — Python package

- **Scraper:** OSM Overpass queries for `abandoned=*`, `ruins=yes`,
  `disused=*`, `historic=*`, `building=ruins`. Pagination + rate limiting.
- **Imagery:** resolve `image`/`wikimedia_commons` tags to actual image URLs.
- **Embedding pipeline:** batched CLIP (`open_clip` ViT-B/32); normalized
  vectors.
- **Cleaning:** dedup by proximity + name; drop entries without usable imagery.
- **Loader:** writes PostGIS rows and triggers an index build.
- **`modal_embed.py`:** documented Modal scale-out variant (not required to run).

### 4.5 `web/` — Next.js frontend

- Interactive MapLibre map with location pins and clustering.
- Drag-and-drop image upload; ranked similarity results as metadata cards
  linked to map pins.
- Auth pages, saved-locations view, contributor submission form.
- Dark "field-survey" visual theme suited to the urbex subject.

### 4.6 `infra/` — Terraform

Full AWS topology: ECS (Rust backend), RDS PostgreSQL+PostGIS, S3+CloudFront for
imagery, scoped IAM roles, Route53 + ACM for HTTPS, VPC/security groups.
`terraform validate` runs clean in CI; never `apply`-ed by this project.

### 4.7 `deploy/` + observability

`docker-compose.yml` boots PostGIS, Redis, the Rust backend, the OTel collector,
Prometheus, Grafana, and the Next.js app. Grafana ships with a provisioned
dashboard reading the backend's Prometheus metrics.

### 4.8 CI — `.github/workflows/`

Rust: `cargo test`, `cargo clippy -D warnings`, `cargo bench` (smoke).
Python: lint + import check. Web: `next build`. Containers: docker build.
Terraform: `terraform validate`.

## 5. Data model (PostGIS)

`locations`: id, name, description, `geom geography(Point,4326)`, era,
structure_type, verified_status, verified_at, image_url, source, source_id,
embedding_id, created_at.

`users`: id, email, password_hash, created_at.

`saved_locations`: user_id, location_id, created_at.

`contributions`: id, user_id, payload (proposed location), status, created_at.

Spatial GIST index on `locations.geom`.

## 6. Performance targets

- Recall@10 within ~2% of an exact-kNN baseline at matched parameters.
- Sub-20ms P99 HNSW query latency at 100k+ vectors.
- Sub-200ms end-to-end including geospatial filter and DB join.
- Index build-time benchmark recorded.

These are measured and reported in `benchmarks/`; the report states whatever the
real numbers turn out to be.

## 7. Testing strategy

- `hnsw`: property tests (retrievability, recall floor, persistence round-trip)
  + unit tests for distance metrics and the candidate heap.
- `server`: integration tests against an ephemeral PostGIS (docker) — hybrid
  ranking, auth, search endpoints.
- `ingestion`: unit tests for the Overpass parser and cleaning logic with
  recorded fixtures (no live network in tests).
- `web`: build + component smoke tests.
- CI gates all of the above.

## 8. Build order

1. `crates/hnsw` — index + property tests + benchmark harness + report.
2. `crates/proto` + `crates/server` — API, hybrid ranking, auth, observability.
3. `ingestion/` — scraper, embeddings, loader; populate a real dataset.
4. `web/` — map frontend wired to the backend.
5. `deploy/` + `observability/` — docker-compose full stack.
6. `infra/` + CI — Terraform and GitHub Actions.
7. `README.md` + `docs/` — recruiter-facing polish, ADRs, benchmark report.

Each layer must build and pass tests before the next begins.
