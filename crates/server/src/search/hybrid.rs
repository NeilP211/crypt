//! Hybrid ranking: blends vector similarity, geographic proximity, and
//! metadata trust into a single score.
//!
//! Each component is normalized to `[0, 1]` independently, then combined with
//! configurable weights. Normalizing first means the weights express relative
//! importance directly, regardless of each signal's natural scale.

use crate::config::RankWeights;

/// Map a cosine distance (`[0, 2]`) to a similarity score (`[0, 1]`), where
/// an identical embedding scores 1.0.
pub fn vector_score(cosine_distance: f32) -> f64 {
    (1.0 - cosine_distance as f64 / 2.0).clamp(0.0, 1.0)
}

/// Map a great-circle distance to a proximity score (`[0, 1]`). A location at
/// the origin scores 1.0; one at or beyond the reference radius scores 0.0.
/// When the request gave no origin, `distance_meters` is negative and the
/// score is 0.0 (the caller drops the geo weight in that case).
pub fn geo_score(distance_meters: f64, radius_meters: f64) -> f64 {
    if distance_meters < 0.0 {
        return 0.0;
    }
    let reference = if radius_meters > 0.0 {
        radius_meters
    } else {
        50_000.0
    };
    (1.0 - distance_meters / reference).clamp(0.0, 1.0)
}

/// Map a verification status to a trust score (`[0, 1]`). Verified locations
/// are surfaced above unconfirmed ones; demolished sites are demoted.
pub fn metadata_score(verified_status: &str) -> f64 {
    match verified_status {
        "verified" => 1.0,
        "unverified" => 0.6,
        "demolished" => 0.25,
        _ => 0.5,
    }
}

/// Combine the three component scores. When the request supplied no origin,
/// the geo weight is dropped and the remaining weights are renormalized so the
/// final score still spans `[0, 1]`.
pub fn hybrid_score(
    weights: RankWeights,
    vector: f64,
    geo: f64,
    metadata: f64,
    has_origin: bool,
) -> f64 {
    let (wv, wg, wm) = if has_origin {
        (weights.vector, weights.geo, weights.metadata)
    } else {
        (weights.vector, 0.0, weights.metadata)
    };
    let total = wv + wg + wm;
    if total <= 0.0 {
        return vector;
    }
    (wv * vector + wg * geo + wm * metadata) / total
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn vector_score_spans_unit_interval() {
        assert_eq!(vector_score(0.0), 1.0);
        assert_eq!(vector_score(2.0), 0.0);
        assert!((vector_score(1.0) - 0.5).abs() < 1e-9);
    }

    #[test]
    fn geo_score_decays_with_distance() {
        assert_eq!(geo_score(0.0, 10_000.0), 1.0);
        assert_eq!(geo_score(10_000.0, 10_000.0), 0.0);
        assert_eq!(geo_score(-1.0, 10_000.0), 0.0);
        assert!(geo_score(2_500.0, 10_000.0) > 0.7);
    }

    #[test]
    fn hybrid_without_origin_ignores_geo() {
        let w = RankWeights::default();
        // A perfect geo score must not change the result when there is no
        // origin — only vector and metadata contribute.
        let a = hybrid_score(w, 0.8, 0.0, 0.6, false);
        let b = hybrid_score(w, 0.8, 1.0, 0.6, false);
        assert!((a - b).abs() < 1e-9);
    }

    #[test]
    fn hybrid_score_stays_in_unit_interval() {
        let w = RankWeights::default();
        for &(v, g, m) in &[(0.0, 0.0, 0.0), (1.0, 1.0, 1.0), (0.3, 0.9, 0.5)] {
            let s = hybrid_score(w, v, g, m, true);
            assert!((0.0..=1.0).contains(&s), "score {s} out of range");
        }
    }
}
