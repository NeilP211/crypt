# Crypt Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan
> phase-by-phase. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Crypt — a geospatial visual search engine for urban exploration
with a from-scratch Rust HNSW index, axum backend, Python ingestion, and a
Next.js + MapLibre frontend, runnable end-to-end via docker-compose.

**Architecture:** Cargo workspace (`hnsw`, `server`, `proto` crates) + Python
ingestion package + Next.js app. The `hnsw` crate is a standalone ANN index;
`server` wraps it with REST/gRPC, PostGIS hybrid ranking, JWT auth, and
observability. Ingestion scrapes OSM and produces CLIP embeddings. docker-compose
boots the whole stack.

**Tech Stack:** Rust (axum, tonic, sqlx, criterion, proptest), PostgreSQL +
PostGIS, Redis, Python (open_clip, requests), Next.js + TypeScript + MapLibre GL
JS, Terraform, GitHub Actions, OpenTelemetry + Prometheus + Grafana.

---

## Phase 1: `crates/hnsw` — the hero index

**Files:** `Cargo.toml` (workspace), `crates/hnsw/Cargo.toml`,
`crates/hnsw/src/{lib,distance,node,index,persist}.rs`,
`crates/hnsw/tests/properties.rs`, `crates/hnsw/benches/recall_latency.rs`,
`crates/hnsw/src/bin/report.rs`.

- [ ] Create the Cargo workspace and `hnsw` library crate skeleton.
- [ ] Implement `distance.rs`: cosine + L2 metrics with unit tests.
- [ ] Implement the HNSW graph (`node.rs`, `index.rs`): configurable `M`,
      `ef_construction`, `ef_search`; layered insert; greedy descent +
      best-first layer-0 search with a candidate heap; neighbor-selection
      heuristic.
- [ ] Implement `persist.rs`: serialize/deserialize index to disk.
- [ ] Write `proptest` property tests: inserted vectors retrievable, recall
      floor on random data, persistence round-trip.
- [ ] Write the benchmark harness (`benches/recall_latency.rs`): recall@k vs.
      brute-force exact kNN at 100k vectors; `criterion` query-latency and
      build-time benchmarks.
- [ ] Write `report.rs` binary that runs the harness and emits a markdown
      report to `benchmarks/`.
- [ ] **Gate:** `cargo test -p hnsw` green, `cargo clippy` clean, report
      generated with real numbers. Commit.

## Phase 2: `crates/proto` + `crates/server` — backend

**Files:** `crates/proto/{Cargo.toml,build.rs,proto/crypt.proto,src/lib.rs}`,
`crates/server/Cargo.toml`,
`crates/server/src/{main,config,error,state}.rs`,
`crates/server/src/db/{mod,migrations}.rs`,
`crates/server/src/auth/{mod,jwt,password,middleware}.rs`,
`crates/server/src/search/{mod,hybrid,embed_client}.rs`,
`crates/server/src/api/{rest,grpc}.rs`,
`crates/server/src/observability.rs`,
`crates/server/migrations/*.sql`,
`crates/server/tests/integration.rs`.

- [ ] Define `crypt.proto` (search service) and compile with `tonic-build`.
- [ ] Create the server crate skeleton: config, error type, app state.
- [ ] Write SQL migrations: `locations`, `users`, `saved_locations`,
      `contributions`; GIST index on `locations.geom`.
- [ ] Implement auth: argon2id hashing, JWT access/refresh, auth middleware,
      register/login handlers.
- [ ] Implement the hybrid ranker: normalized blend of vector similarity,
      PostGIS geographic distance, and metadata-filter match.
- [ ] Implement the embedding client (calls the Python embed service for
      uploaded images).
- [ ] Wire REST endpoints (search, locations, saved, contribute) and the gRPC
      service over a shared service layer.
- [ ] Add OpenTelemetry tracing + Prometheus `/metrics`.
- [ ] Add Redis caching for hot query results.
- [ ] Write integration tests against an ephemeral PostGIS container.
- [ ] **Gate:** `cargo test` green, `cargo clippy` clean. Commit.

## Phase 3: `ingestion/` — data pipeline

**Files:** `ingestion/{pyproject.toml,README.md}`,
`ingestion/crypt_ingest/{__init__,overpass,imagery,embed,clean,load,cli}.py`,
`ingestion/crypt_ingest/modal_embed.py`,
`ingestion/tests/{test_overpass,test_clean}.py`,
`ingestion/tests/fixtures/*.json`.

- [ ] Create the Python package with `pyproject.toml`.
- [ ] Implement the Overpass scraper (abandoned/ruins/disused/historic tags,
      pagination, rate limiting).
- [ ] Implement imagery resolution (OSM `image`/`wikimedia_commons` tags).
- [ ] Implement the batched CLIP embedding pipeline (`open_clip` ViT-B/32).
- [ ] Implement dedup + cleaning.
- [ ] Implement the PostGIS loader + index-build trigger.
- [ ] Add the `modal_embed.py` scale-out variant.
- [ ] Write unit tests for the Overpass parser and cleaning with recorded
      fixtures (no live network).
- [ ] **Gate:** `pytest` green; a real OSM scrape populates the dev DB. Commit.

## Phase 4: `web/` — Next.js + MapLibre frontend

**Files:** `web/{package.json,next.config.js,tsconfig.json,tailwind.config.ts}`,
`web/src/app/{layout,page,globals.css}.tsx`,
`web/src/app/(auth)/{login,register}/page.tsx`,
`web/src/app/saved/page.tsx`, `web/src/app/contribute/page.tsx`,
`web/src/components/{Map,UploadDropzone,ResultCard,ResultList,Nav}.tsx`,
`web/src/lib/{api,auth,types}.ts`.

- [ ] Scaffold the Next.js App Router project with TypeScript + Tailwind.
- [ ] Build the API client and shared types.
- [ ] Build the MapLibre map component with pins + clustering.
- [ ] Build the image upload dropzone and ranked result list/cards.
- [ ] Build auth pages, saved-locations view, contributor form.
- [ ] Apply the dark "field-survey" theme.
- [ ] **Gate:** `next build` succeeds; manual smoke against the local backend.
      Commit.

## Phase 5: `deploy/` + `observability/` — full local stack

**Files:** `deploy/{docker-compose.yml,Dockerfile.server,Dockerfile.web}`,
`observability/{prometheus.yml,otel-collector.yml}`,
`observability/grafana/{datasources,dashboards}/*`, `Makefile`.

- [ ] Write Dockerfiles for the Rust backend and Next.js app.
- [ ] Write `docker-compose.yml`: PostGIS, Redis, server, web, OTel collector,
      Prometheus, Grafana.
- [ ] Write Prometheus + OTel collector configs and a provisioned Grafana
      dashboard.
- [ ] Write a `Makefile` (`up`, `down`, `ingest`, `bench`, `test`).
- [ ] **Gate:** `docker-compose up` boots the full stack; search works
      end-to-end. Commit.

## Phase 6: `infra/` + CI

**Files:** `infra/{main,variables,outputs,ecs,rds,s3_cloudfront,iam,dns}.tf`,
`.github/workflows/{ci,terraform}.yml`.

- [ ] Write Terraform for ECS, RDS PostgreSQL+PostGIS, S3+CloudFront, scoped
      IAM, Route53 + ACM, VPC/security groups.
- [ ] Write the CI workflow: Rust test/clippy/bench, Python lint, web build,
      docker build.
- [ ] Write the Terraform workflow: `terraform validate`.
- [ ] **Gate:** `terraform validate` clean. Commit.

## Phase 7: README + docs polish

**Files:** `README.md`, `docs/architecture.md`,
`docs/adr/000{1,2,3}-*.md`, `benchmarks/REPORT.md`.

- [ ] Write the recruiter-facing `README.md`: hero summary, architecture
      diagram, quickstart, benchmark numbers, resume bullets.
- [ ] Write `docs/architecture.md` and 3 ADRs (HNSW from scratch, MapLibre vs.
      Mapbox, in-house auth).
- [ ] Finalize the benchmark report.
- [ ] **Gate:** full `cargo test` + `pytest` + `next build` green. Final commit.
