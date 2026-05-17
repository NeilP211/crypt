//! The search service: turns a query embedding into a ranked list of
//! locations by combining the ANN index, PostGIS, and hybrid ranking.

pub mod embed_client;
pub mod hybrid;

use std::collections::HashMap;
use std::hash::{Hash, Hasher};
use std::time::Instant;

use crate::db;
use crate::domain::{Location, ScoredLocation, SearchQuery};
use crate::error::{AppError, AppResult};
use crate::state::AppState;

/// How many ANN candidates to fetch per requested result. Over-fetching gives
/// the metadata/geo filters room to discard non-matches without starving the
/// final ranking.
const OVERFETCH: usize = 6;
/// Hard cap on ANN candidates, bounding the PostGIS round-trip.
const MAX_CANDIDATES: usize = 300;

/// Run a hybrid search end to end: ANN lookup, PostGIS hydration + distance,
/// metadata filtering, hybrid scoring, and (optional) Redis caching.
pub async fn run_search(state: &AppState, query: SearchQuery) -> AppResult<Vec<ScoredLocation>> {
    let started = Instant::now();

    if query.embedding.len() != state.index.dim() {
        return Err(AppError::BadRequest(format!(
            "embedding has {} dimensions, index expects {}",
            query.embedding.len(),
            state.index.dim()
        )));
    }
    if state.index.is_empty() {
        return Ok(Vec::new());
    }

    let key = cache_key(&query);
    if let Some(cached) = cache_get(state, &key).await {
        state.metrics.cache_hits.inc();
        return Ok(cached);
    }
    state.metrics.cache_misses.inc();

    // 1. Approximate nearest neighbors from the HNSW index.
    let candidate_n = (query.limit * OVERFETCH).clamp(query.limit.max(1), MAX_CANDIDATES);
    let ef = candidate_n.max(64);
    let hits = state
        .index
        .search_with_ef(&query.embedding, candidate_n, ef);
    let embedding_ids: Vec<i32> = hits.iter().map(|(id, _)| *id as i32).collect();
    let vector_distance: HashMap<i32, f32> = hits.iter().map(|(id, d)| (*id as i32, *d)).collect();

    // 2. Hydrate from PostGIS, computing geographic distance in the same query.
    let candidates =
        db::locations::fetch_candidates(&state.db, &embedding_ids, query.origin).await?;

    // 3. Filter, score, rank.
    let has_origin = query.origin.is_some();
    let weights = state.config.weights;
    let mut scored: Vec<ScoredLocation> = candidates
        .into_iter()
        .filter(|(loc, dist)| passes_filters(loc, *dist, &query))
        .map(|(loc, distance)| {
            let vdist = loc
                .embedding_id
                .and_then(|id| vector_distance.get(&id).copied())
                .unwrap_or(2.0);
            let vector = hybrid::vector_score(vdist);
            let geo = hybrid::geo_score(distance, query.radius_meters);
            let metadata = hybrid::metadata_score(&loc.verified_status);
            let hybrid_score = hybrid::hybrid_score(weights, vector, geo, metadata, has_origin);
            ScoredLocation {
                location: loc,
                vector_score: vector,
                geo_score: geo,
                metadata_score: metadata,
                hybrid_score,
                distance_meters: distance,
            }
        })
        .collect();
    scored.sort_by(|a, b| b.hybrid_score.total_cmp(&a.hybrid_score));
    scored.truncate(query.limit);

    cache_set(state, &key, &scored).await;
    state
        .metrics
        .search_latency
        .observe(started.elapsed().as_secs_f64());
    Ok(scored)
}

/// Apply the radius and metadata filters. Empty filter lists are no-ops.
fn passes_filters(location: &Location, distance: f64, query: &SearchQuery) -> bool {
    if query.radius_meters > 0.0 && distance >= 0.0 && distance > query.radius_meters {
        return false;
    }
    let f = &query.filters;
    if !f.era.is_empty() && !f.era.contains(&location.era) {
        return false;
    }
    if !f.structure_type.is_empty() && !f.structure_type.contains(&location.structure_type) {
        return false;
    }
    if !f.verified_status.is_empty() && !f.verified_status.contains(&location.verified_status) {
        return false;
    }
    true
}

/// A deterministic cache key for a query. Float bits are hashed so two
/// byte-identical queries always collide and nothing else does.
fn cache_key(query: &SearchQuery) -> String {
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    for v in &query.embedding {
        v.to_bits().hash(&mut hasher);
    }
    if let Some((lat, lng)) = query.origin {
        lat.to_bits().hash(&mut hasher);
        lng.to_bits().hash(&mut hasher);
    }
    query.radius_meters.to_bits().hash(&mut hasher);
    query.filters.era.hash(&mut hasher);
    query.filters.structure_type.hash(&mut hasher);
    query.filters.verified_status.hash(&mut hasher);
    query.limit.hash(&mut hasher);
    format!("crypt:search:{:016x}", hasher.finish())
}

async fn cache_get(state: &AppState, key: &str) -> Option<Vec<ScoredLocation>> {
    let mut conn = state.redis.clone()?;
    let raw: Option<String> = redis::cmd("GET")
        .arg(key)
        .query_async(&mut conn)
        .await
        .ok()?;
    serde_json::from_str(&raw?).ok()
}

async fn cache_set(state: &AppState, key: &str, value: &[ScoredLocation]) {
    let Some(mut conn) = state.redis.clone() else {
        return;
    };
    let Ok(json) = serde_json::to_string(value) else {
        return;
    };
    let _: Result<(), redis::RedisError> = redis::cmd("SET")
        .arg(key)
        .arg(json)
        .arg("EX")
        .arg(state.config.cache_ttl_secs)
        .query_async(&mut conn)
        .await;
}
