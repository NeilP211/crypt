# Crypt — Architecture

Crypt is a geospatial visual search engine for abandoned and historic
locations. This document describes how the pieces fit together.

## Components

| Component | Tech | Responsibility |
|-----------|------|----------------|
| `crates/hnsw` | Rust | From-scratch HNSW ANN index + benchmark harness |
| `crates/proto` | Rust / protobuf | gRPC service and message definitions |
| `crates/server` | Rust (axum, tonic) | REST + gRPC API, hybrid ranking, auth, caching |
| `ingestion` | Python | OSM scraping, CLIP embedding, PostGIS loading |
| `web` | Next.js + TypeScript | Map UI, image-upload search, accounts |
| `infra` | Terraform | AWS deployment topology |
| `observability` | Prometheus, Grafana, OTel | Metrics and dashboards |

## Request path: a visual search

```
   Browser (Next.js + MapLibre)
        │  multipart POST /api/search/image
        ▼
   crypt-server (axum)
        │  1. forward image bytes
        ▼
   embed service (FastAPI + CLIP)  ──►  512-d embedding
        │
        ▼
   HNSW index (in-process)         ──►  candidate embedding_ids + distances
        │
        ▼
   PostGIS                         ──►  hydrate rows, compute ST_Distance
        │
        ▼
   hybrid ranker                   ──►  blend vector + geo + metadata scores
        │
        ▼
   Redis (cache the result)
        │
        ▼
   JSON response  ──►  ranked ResultCards + map pins
```

The same search core is exposed over gRPC (`SearchService`) for
service-to-service callers.

## Data flow: ingestion

Ingestion is an offline batch job:

```
OSM Overpass API ──► parse + classify ──► clean / dedupe ──► resolve imagery
        │
        ▼
   download images ──► CLIP embeddings ──► embeddings.bin  +  PostGIS rows
        │
        ▼
   build-index (Rust) ──► crypt.index  ──► loaded by the server at startup
```

`embeddings.bin` is a language-neutral flat format (`[u32 count][u32 dim]
[f32 …]`); row `i` is `locations.embedding_id = i`, which links an index hit
back to a database row.

## Hybrid ranking

A result's final score is a weighted blend of three components, each
normalized to `[0, 1]`:

- **vector** — CLIP cosine similarity, from the HNSW distance.
- **geo** — proximity to the search origin, from PostGIS `ST_Distance`.
- **metadata** — a trust score from the location's verified status.

When a request supplies no origin, the geo weight is dropped and the rest are
renormalized. Weights are configurable via environment variables.

## Why these boundaries

- The **`hnsw` crate has no dependency on the rest of the workspace** — it is
  a standalone, independently testable ANN library.
- The **server never runs a neural network**; embedding is delegated to a
  Python service, keeping the Rust binary small and the model swappable.
- **Ingestion is fully decoupled** from serving — it writes a file and DB
  rows; the server only reads them.

See the `docs/adr/` directory for the rationale behind specific decisions.
