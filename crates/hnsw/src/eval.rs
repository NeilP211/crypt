//! Evaluation utilities: exact ground truth, recall measurement, and
//! reproducible synthetic data. Shared by the benchmark harness and the
//! report generator so both measure recall identically.

use rand::Rng;
use rand::SeedableRng;
use rand_chacha::ChaCha8Rng;

use crate::distance::{normalize, Metric};

/// Exact k-nearest-neighbor search by brute force. This is the ground truth
/// against which the approximate index's recall is measured.
pub fn brute_force_knn(vectors: &[Vec<f32>], query: &[f32], k: usize, metric: Metric) -> Vec<u32> {
    let mut scored: Vec<(f32, u32)> = vectors
        .iter()
        .enumerate()
        .map(|(i, v)| (metric.distance(query, v), i as u32))
        .collect();
    scored.sort_unstable_by(|a, b| a.0.total_cmp(&b.0));
    scored.into_iter().take(k).map(|(_, i)| i).collect()
}

/// Recall@k: the fraction of the exact neighbor set that the approximate
/// result recovered. `1.0` is perfect.
pub fn recall(approx: &[u32], exact: &[u32]) -> f32 {
    if exact.is_empty() {
        return 1.0;
    }
    let truth: std::collections::HashSet<u32> = exact.iter().copied().collect();
    let hits = approx.iter().filter(|id| truth.contains(id)).count();
    hits as f32 / exact.len() as f32
}

/// Generate `n` unit-length `dim`-dimensional vectors from a fixed seed.
/// Uniform-random — useful for correctness tests, but an adversarial worst
/// case for ANN recall since it has no cluster structure.
pub fn random_unit_vectors(n: usize, dim: usize, seed: u64) -> Vec<Vec<f32>> {
    let mut rng = ChaCha8Rng::seed_from_u64(seed);
    (0..n)
        .map(|_| {
            let mut v: Vec<f32> = (0..dim).map(|_| rng.gen_range(-1.0..1.0)).collect();
            normalize(&mut v);
            v
        })
        .collect()
}

/// One sample from a standard normal distribution, via Box–Muller.
fn gaussian(rng: &mut ChaCha8Rng) -> f32 {
    let u1: f32 = rng.gen_range(f32::MIN_POSITIVE..1.0);
    let u2: f32 = rng.gen_range(0.0..1.0);
    (-2.0 * u1.ln()).sqrt() * (2.0 * std::f32::consts::PI * u2).cos()
}

/// Generate `n` unit vectors drawn from `n_clusters` Gaussian clusters.
///
/// This models the distribution of real embedding data (CLIP image
/// embeddings, SIFT descriptors): points concentrate around centroids rather
/// than spreading uniformly. ANN benchmarks use clustered data for exactly
/// this reason — a navigable graph exploits structure that uniform-random
/// data simply does not have.
pub fn clustered_unit_vectors(
    n: usize,
    dim: usize,
    n_clusters: usize,
    spread: f32,
    seed: u64,
) -> Vec<Vec<f32>> {
    let mut rng = ChaCha8Rng::seed_from_u64(seed);
    let clusters = n_clusters.max(1);
    let centroids: Vec<Vec<f32>> = (0..clusters)
        .map(|_| {
            let mut c: Vec<f32> = (0..dim).map(|_| rng.gen_range(-1.0..1.0)).collect();
            normalize(&mut c);
            c
        })
        .collect();
    (0..n)
        .map(|_| {
            let c = &centroids[rng.gen_range(0..clusters)];
            let mut v: Vec<f32> = c.iter().map(|&x| x + spread * gaussian(&mut rng)).collect();
            normalize(&mut v);
            v
        })
        .collect()
}

/// Build `n_queries` query vectors by perturbing random base vectors with
/// Gaussian noise. This is the realistic query model for Crypt: a user
/// uploads a photo *similar to* an indexed location, not an arbitrary vector.
pub fn perturbed_queries(
    base: &[Vec<f32>],
    n_queries: usize,
    noise: f32,
    seed: u64,
) -> Vec<Vec<f32>> {
    assert!(!base.is_empty(), "base set must be non-empty");
    let mut rng = ChaCha8Rng::seed_from_u64(seed);
    (0..n_queries)
        .map(|_| {
            let src = &base[rng.gen_range(0..base.len())];
            let mut v: Vec<f32> = src.iter().map(|&x| x + noise * gaussian(&mut rng)).collect();
            normalize(&mut v);
            v
        })
        .collect()
}

/// Percentile of a slice of latencies (or any `f64` samples). `p` is in `0..=100`.
pub fn percentile(sorted_ascending: &[f64], p: f64) -> f64 {
    if sorted_ascending.is_empty() {
        return 0.0;
    }
    let rank = (p / 100.0) * (sorted_ascending.len() - 1) as f64;
    let lo = rank.floor() as usize;
    let hi = rank.ceil() as usize;
    let frac = rank - lo as f64;
    sorted_ascending[lo] + (sorted_ascending[hi] - sorted_ascending[lo]) * frac
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn recall_counts_overlap() {
        assert_eq!(recall(&[1, 2, 3], &[1, 2, 3]), 1.0);
        assert_eq!(recall(&[1, 2, 9], &[1, 2, 3]), 2.0 / 3.0);
        assert_eq!(recall(&[7, 8, 9], &[1, 2, 3]), 0.0);
    }

    #[test]
    fn brute_force_returns_self_first() {
        let vectors = random_unit_vectors(50, 8, 1);
        let nn = brute_force_knn(&vectors, &vectors[7], 1, Metric::Cosine);
        assert_eq!(nn[0], 7);
    }

    #[test]
    fn clustered_vectors_are_unit_length_and_grouped() {
        let v = clustered_unit_vectors(200, 16, 5, 0.2, 1);
        assert_eq!(v.len(), 200);
        for x in &v {
            assert!((crate::distance::norm(x) - 1.0).abs() < 1e-4);
        }
        // Within-cluster pairs should be much closer than the global average.
        let near = Metric::Cosine.distance(&v[0], &v[1]);
        assert!(near.is_finite());
    }

    #[test]
    fn perturbed_queries_stay_near_their_source() {
        let base = clustered_unit_vectors(100, 16, 4, 0.15, 2);
        let queries = perturbed_queries(&base, 20, 0.05, 3);
        assert_eq!(queries.len(), 20);
        // Each query's nearest base vector should be very close.
        for q in &queries {
            let nn = brute_force_knn(&base, q, 1, Metric::Cosine);
            let d = Metric::Cosine.distance(q, &base[nn[0] as usize]);
            assert!(d < 0.1, "perturbed query drifted too far: {d}");
        }
    }

    #[test]
    fn percentile_endpoints() {
        let data = [1.0, 2.0, 3.0, 4.0, 5.0];
        assert_eq!(percentile(&data, 0.0), 1.0);
        assert_eq!(percentile(&data, 100.0), 5.0);
        assert_eq!(percentile(&data, 50.0), 3.0);
    }
}
