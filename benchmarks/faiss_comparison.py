"""FAISS HNSW comparison for Crypt's from-scratch index.

This builds a FAISS HNSW index with the *same parameters* and the *same data
distribution* as the Rust benchmark in `crates/hnsw/src/bin/report.rs`
(100k clustered 128-d vectors, M = 24, ef_construction = 256) and measures
recall@10 against exact kNN — a direct, same-methodology counterpart to
`benchmarks/REPORT.md`.

Vectors are L2-normalized, so L2 nearest neighbors are identical to cosine
nearest neighbors; both indexes use L2.

    pip install faiss-cpu numpy
    python benchmarks/faiss_comparison.py
"""

from __future__ import annotations

import time

import numpy as np

try:
    import faiss
except ImportError as exc:  # pragma: no cover
    raise SystemExit("faiss is required: pip install faiss-cpu") from exc


def clustered_unit_vectors(n, dim, n_clusters, spread, seed):
    """Gaussian-mixture unit vectors — mirrors the Rust benchmark's data."""
    rng = np.random.default_rng(seed)
    centroids = rng.standard_normal((n_clusters, dim)).astype("float32")
    centroids /= np.linalg.norm(centroids, axis=1, keepdims=True)
    assignment = rng.integers(0, n_clusters, size=n)
    noise = rng.standard_normal((n, dim)).astype("float32") * spread
    vectors = centroids[assignment] + noise
    vectors /= np.linalg.norm(vectors, axis=1, keepdims=True)
    return vectors


def perturbed_queries(base, n_queries, noise, seed):
    """Queries are noised copies of indexed vectors — the realistic model."""
    rng = np.random.default_rng(seed)
    idx = rng.integers(0, len(base), size=n_queries)
    queries = base[idx] + rng.standard_normal(
        (n_queries, base.shape[1])
    ).astype("float32") * noise
    queries /= np.linalg.norm(queries, axis=1, keepdims=True)
    return queries


def main() -> None:
    n, dim, k = 100_000, 128, 10
    m, ef_construction = 24, 256

    print(f"generating {n} clustered vectors (dim {dim})...")
    base = clustered_unit_vectors(n, dim, 500, 0.15, 42)
    queries = perturbed_queries(base, 1000, 0.08, 7)

    print("computing exact ground truth...")
    exact = faiss.IndexFlatL2(dim)
    exact.add(base)
    _, truth = exact.search(queries, k)

    print(f"building FAISS HNSW (M={m}, ef_construction={ef_construction})...")
    index = faiss.IndexHNSWFlat(dim, m)
    index.hnsw.efConstruction = ef_construction
    start = time.perf_counter()
    index.add(base)
    build_secs = time.perf_counter() - start

    print(f"\nFAISS HNSW — build {build_secs:.1f}s\n")
    print(f"{'ef_search':>10} {'recall@10':>11} {'P50 ms':>9} {'P99 ms':>9}")
    print("-" * 42)
    for ef in (16, 32, 64, 128, 256, 512):
        index.hnsw.efSearch = ef
        latencies = []
        recalls = []
        for i, query in enumerate(queries):
            start = time.perf_counter()
            _, found = index.search(query.reshape(1, -1), k)
            latencies.append((time.perf_counter() - start) * 1000.0)
            overlap = len(set(found[0].tolist()) & set(truth[i].tolist()))
            recalls.append(overlap / k)
        latencies.sort()
        p50 = latencies[len(latencies) // 2]
        p99 = latencies[int(len(latencies) * 0.99)]
        print(
            f"{ef:>10} {np.mean(recalls) * 100:>10.2f}% "
            f"{p50:>8.3f} {p99:>8.3f}"
        )


if __name__ == "__main__":
    main()
