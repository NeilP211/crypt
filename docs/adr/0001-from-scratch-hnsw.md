# ADR 0001 — Implement HNSW from scratch in Rust

**Status:** accepted

## Context

Crypt needs approximate nearest-neighbor (ANN) search over CLIP image
embeddings. The obvious choice is an off-the-shelf library — FAISS, hnswlib,
or a hosted vector database.

## Decision

Implement the HNSW (Hierarchical Navigable Small World) index from scratch in
Rust, as the `hnsw` crate, with no third-party ANN dependency.

## Rationale

- **It is the project's centerpiece.** Crypt exists partly to demonstrate that
  the ANN index — graph construction, the layered greedy search, the
  neighbor-selection heuristic — is understood deeply enough to build, not
  just call.
- **Honest benchmarking.** Recall is measured against brute-force *exact* kNN,
  a stricter reference than comparing two approximate libraries. The harness
  and report are part of the crate.
- **No FFI, no service.** A pure-Rust library compiles into the backend with
  zero deployment surface — no FAISS build, no separate vector database.
- **Control.** Persistence format, distance metrics, and tuning are all owned.

## Consequences

- The implementation is a correct, benchmarked HNSW but not as micro-optimized
  as FAISS (no SIMD kernels, no quantization). At 100k vectors it reaches
  recall@10 ≈ 97% versus exact kNN with sub-5 ms P99 latency — competitive,
  and the gap is documented honestly in `benchmarks/REPORT.md`.
- A `faiss_comparison.py` script is provided to run FAISS HNSW on identical
  data for a direct head-to-head.
- The crate is reusable and independently testable, with property tests and
  `criterion` benchmarks.
