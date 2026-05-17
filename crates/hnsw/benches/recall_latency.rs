//! Criterion micro-benchmarks for the HNSW index.
//!
//! Covers the two latency-critical operations: index construction and query.
//! For a full recall-vs-latency sweep with a written report, use the
//! `hnsw-report` binary instead.

use criterion::{black_box, criterion_group, criterion_main, BenchmarkId, Criterion};
use hnsw::eval::random_unit_vectors;
use hnsw::{HnswConfig, HnswIndex, Metric};

fn build_index(vectors: &[Vec<f32>], dim: usize) -> HnswIndex {
    let config = HnswConfig::new(Metric::Cosine)
        .with_m(16)
        .with_ef_construction(200);
    let mut index = HnswIndex::new(dim, config);
    for v in vectors {
        index.insert(v);
    }
    index
}

fn bench_build(c: &mut Criterion) {
    let dim = 128;
    let mut group = c.benchmark_group("build");
    group.sample_size(10);
    for &n in &[1_000usize, 5_000] {
        let vectors = random_unit_vectors(n, dim, 1);
        group.bench_with_input(BenchmarkId::from_parameter(n), &vectors, |b, vectors| {
            b.iter(|| build_index(black_box(vectors), dim));
        });
    }
    group.finish();
}

fn bench_query(c: &mut Criterion) {
    let dim = 128;
    let n = 50_000;
    let vectors = random_unit_vectors(n, dim, 1);
    let index = build_index(&vectors, dim);
    let queries = random_unit_vectors(200, dim, 99);

    let mut group = c.benchmark_group("query_50k");
    for &ef in &[16usize, 64, 128] {
        group.bench_with_input(BenchmarkId::from_parameter(ef), &ef, |b, &ef| {
            let mut i = 0usize;
            b.iter(|| {
                let q = &queries[i % queries.len()];
                i += 1;
                black_box(index.search_with_ef(black_box(q), 10, ef))
            });
        });
    }
    group.finish();
}

criterion_group!(benches, bench_build, bench_query);
criterion_main!(benches);
