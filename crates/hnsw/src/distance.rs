//! Distance metrics for vector comparison.
//!
//! CLIP image embeddings are compared with cosine distance; L2 is provided for
//! benchmarking and general use. Cosine distance is `1 - cosine_similarity`, so
//! identical vectors have distance 0 and opposite vectors have distance 2.

use serde::{Deserialize, Serialize};

/// A distance metric used to compare vectors inside the index.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Metric {
    /// Cosine distance: `1 - (a·b)/(‖a‖‖b‖)`. The natural choice for CLIP.
    Cosine,
    /// Squared Euclidean distance. Monotonic in true L2, cheaper to compute.
    L2,
}

impl Metric {
    /// Distance between two equal-length vectors under this metric.
    #[inline]
    pub fn distance(&self, a: &[f32], b: &[f32]) -> f32 {
        debug_assert_eq!(a.len(), b.len(), "vector length mismatch");
        match self {
            Metric::Cosine => cosine_distance(a, b),
            Metric::L2 => l2_squared(a, b),
        }
    }
}

/// Dot product of two equal-length vectors.
#[inline]
pub fn dot(a: &[f32], b: &[f32]) -> f32 {
    a.iter().zip(b).map(|(x, y)| x * y).sum()
}

/// Euclidean norm (magnitude) of a vector.
#[inline]
pub fn norm(a: &[f32]) -> f32 {
    dot(a, a).sqrt()
}

/// Squared Euclidean distance between two vectors.
#[inline]
pub fn l2_squared(a: &[f32], b: &[f32]) -> f32 {
    a.iter()
        .zip(b)
        .map(|(x, y)| {
            let d = x - y;
            d * d
        })
        .sum()
}

/// Cosine distance. Returns 1.0 when either vector is the zero vector, since
/// orientation is undefined there.
#[inline]
pub fn cosine_distance(a: &[f32], b: &[f32]) -> f32 {
    let denom = norm(a) * norm(b);
    if denom == 0.0 {
        return 1.0;
    }
    let sim = (dot(a, b) / denom).clamp(-1.0, 1.0);
    1.0 - sim
}

/// Scale a vector in place to unit length. Zero vectors are left unchanged.
pub fn normalize(v: &mut [f32]) {
    let n = norm(v);
    if n > 0.0 {
        for x in v.iter_mut() {
            *x /= n;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn identical_vectors_have_zero_distance() {
        let v = [0.3_f32, 0.4, 0.5];
        assert!(Metric::Cosine.distance(&v, &v).abs() < 1e-5);
        assert!(Metric::L2.distance(&v, &v).abs() < 1e-6);
    }

    #[test]
    fn cosine_is_symmetric() {
        let a = [1.0_f32, 2.0, 3.0];
        let b = [-1.0_f32, 0.5, 4.0];
        let ab = Metric::Cosine.distance(&a, &b);
        let ba = Metric::Cosine.distance(&b, &a);
        assert!((ab - ba).abs() < 1e-6);
    }

    #[test]
    fn opposite_vectors_have_cosine_distance_two() {
        let a = [1.0_f32, 0.0];
        let b = [-1.0_f32, 0.0];
        assert!((cosine_distance(&a, &b) - 2.0).abs() < 1e-5);
    }

    #[test]
    fn zero_vector_yields_max_cosine_distance() {
        let a = [0.0_f32, 0.0];
        let b = [1.0_f32, 1.0];
        assert_eq!(cosine_distance(&a, &b), 1.0);
    }

    #[test]
    fn normalize_produces_unit_length() {
        let mut v = [3.0_f32, 4.0];
        normalize(&mut v);
        assert!((norm(&v) - 1.0).abs() < 1e-6);
    }
}
