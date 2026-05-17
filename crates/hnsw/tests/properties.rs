//! Property and integration tests for the HNSW index.
//!
//! The property tests assert invariants that must hold for *any* valid input:
//! every inserted vector is retrievable, approximate recall stays above a
//! floor, and persistence round-trips exactly.

use hnsw::eval::{
    brute_force_knn, clustered_unit_vectors, perturbed_queries, random_unit_vectors, recall,
};
use hnsw::{HnswConfig, HnswIndex, Metric};
use proptest::prelude::*;

fn build(vectors: &[Vec<f32>], dim: usize, metric: Metric) -> HnswIndex {
    let config = HnswConfig::new(metric).with_m(16).with_ef_construction(200);
    let mut index = HnswIndex::new(dim, config);
    for v in vectors {
        index.insert(v);
    }
    index
}

#[test]
fn empty_index_returns_no_results() {
    let index = HnswIndex::new(8, HnswConfig::new(Metric::Cosine));
    assert!(index.is_empty());
    assert_eq!(index.search(&[0.0; 8], 5), Vec::new());
}

#[test]
fn single_vector_is_its_own_nearest_neighbor() {
    let mut index = HnswIndex::new(4, HnswConfig::new(Metric::Cosine));
    let id = index.insert(&[0.1, 0.2, 0.3, 0.4]);
    let hits = index.search(&[0.1, 0.2, 0.3, 0.4], 1);
    assert_eq!(hits.len(), 1);
    assert_eq!(hits[0].0, id);
}

#[test]
fn ids_are_assigned_in_insertion_order() {
    let mut index = HnswIndex::new(3, HnswConfig::new(Metric::L2));
    for (expected, v) in [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]]
        .iter()
        .enumerate()
    {
        assert_eq!(index.insert(v) as usize, expected);
    }
    assert_eq!(index.len(), 3);
}

#[test]
fn recall_is_high_on_clustered_data() {
    // Clustered data models real embedding distributions (CLIP, SIFT). On
    // structured data the graph search should closely track exact kNN.
    let dim = 64;
    let base = clustered_unit_vectors(4_000, dim, 20, 0.4, 11);
    let queries = perturbed_queries(&base, 100, 0.12, 22);
    let index = build(&base, dim, Metric::Cosine);

    let mut total = 0.0;
    for q in &queries {
        let exact = brute_force_knn(&base, q, 10, Metric::Cosine);
        let approx: Vec<u32> = index.search(q, 10).iter().map(|(id, _)| *id).collect();
        total += recall(&approx, &exact);
    }
    let mean = total / queries.len() as f32;
    assert!(mean > 0.95, "mean recall@10 was {mean}, expected > 0.95");
}

#[test]
fn persistence_round_trips_exactly() {
    let dim = 32;
    let base = random_unit_vectors(500, dim, 3);
    let index = build(&base, dim, Metric::Cosine);

    let path = std::env::temp_dir().join("hnsw_roundtrip_test.bin");
    index.save(&path).expect("save");
    let loaded = HnswIndex::load(&path).expect("load");
    std::fs::remove_file(&path).ok();

    assert_eq!(loaded.len(), index.len());
    assert_eq!(loaded.dim(), index.dim());
    for q in random_unit_vectors(50, dim, 4) {
        assert_eq!(index.search(&q, 10), loaded.search(&q, 10));
    }
}

#[test]
fn higher_ef_never_reduces_recall() {
    let dim = 48;
    let base = clustered_unit_vectors(3_000, dim, 16, 0.4, 5);
    let queries = perturbed_queries(&base, 80, 0.12, 6);
    let index = build(&base, dim, Metric::Cosine);

    let recall_at = |ef: usize| {
        let mut total = 0.0;
        for q in &queries {
            let exact = brute_force_knn(&base, q, 10, Metric::Cosine);
            let approx: Vec<u32> = index
                .search_with_ef(q, 10, ef)
                .iter()
                .map(|(id, _)| *id)
                .collect();
            total += recall(&approx, &exact);
        }
        total / queries.len() as f32
    };
    // A wider beam should not measurably hurt recall.
    assert!(recall_at(256) + 0.02 >= recall_at(16));
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(12))]

    /// Every inserted vector must be findable as the top-1 hit when used as
    /// its own query — the most basic correctness guarantee.
    #[test]
    fn every_inserted_vector_is_retrievable(
        n in 30usize..150,
        dim in 4usize..24,
        seed in any::<u64>(),
    ) {
        let base = random_unit_vectors(n, dim, seed);
        let index = build(&base, dim, Metric::Cosine);

        let mut found = 0;
        for (id, v) in base.iter().enumerate() {
            let hits = index.search_with_ef(v, 1, 64);
            if hits.first().map(|(h, _)| *h as usize) == Some(id) {
                found += 1;
            }
        }
        // Self-retrieval should be near-perfect for an exact stored query.
        prop_assert!(found as f64 / n as f64 > 0.95);
    }

    /// Search results are always sorted by ascending distance.
    #[test]
    fn results_are_distance_ordered(
        n in 50usize..200,
        dim in 4usize..32,
        seed in any::<u64>(),
    ) {
        let base = random_unit_vectors(n, dim, seed);
        let index = build(&base, dim, Metric::Cosine);
        let query = &random_unit_vectors(1, dim, seed ^ 0xABCD)[0];

        let hits = index.search(query, 10);
        for w in hits.windows(2) {
            prop_assert!(w[0].1 <= w[1].1);
        }
    }

    /// `search` never returns more than `k` results, nor more than `len`.
    #[test]
    fn search_respects_k_bound(
        n in 10usize..120,
        dim in 4usize..16,
        k in 1usize..40,
        seed in any::<u64>(),
    ) {
        let base = random_unit_vectors(n, dim, seed);
        let index = build(&base, dim, Metric::Cosine);
        let query = &random_unit_vectors(1, dim, seed ^ 1)[0];

        let hits = index.search(query, k);
        prop_assert!(hits.len() <= k);
        prop_assert!(hits.len() <= n);
    }
}
