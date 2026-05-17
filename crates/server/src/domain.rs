//! Core domain types shared across the database, search, and API layers.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// A location as stored and returned by the API.
///
/// `embedding_id` is the vector's position in the HNSW index; it links a
/// database row to its entry in the in-memory ANN index.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Location {
    pub id: Uuid,
    pub embedding_id: Option<i32>,
    pub name: String,
    pub description: String,
    pub lat: f64,
    pub lng: f64,
    pub era: String,
    pub structure_type: String,
    pub verified_status: String,
    pub image_url: String,
    pub source: String,
}

/// A location with the scores that produced its ranking.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScoredLocation {
    #[serde(flatten)]
    pub location: Location,
    /// Vector similarity component, `[0, 1]` (1 = identical embedding).
    pub vector_score: f64,
    /// Geographic proximity component, `[0, 1]` (1 = at the origin).
    pub geo_score: f64,
    /// Metadata-filter match component, `[0, 1]`.
    pub metadata_score: f64,
    /// Final blended score, `[0, 1]`.
    pub hybrid_score: f64,
    /// Great-circle distance from the request origin in meters; `-1` if the
    /// request supplied no origin.
    pub distance_meters: f64,
}

/// Filters applied to a search. Empty vectors mean "no constraint".
#[derive(Debug, Clone, Default, Deserialize)]
pub struct SearchFilters {
    #[serde(default)]
    pub era: Vec<String>,
    #[serde(default)]
    pub structure_type: Vec<String>,
    #[serde(default)]
    pub verified_status: Vec<String>,
}

impl SearchFilters {
    /// Whether any filter is set.
    pub fn is_empty(&self) -> bool {
        self.era.is_empty() && self.structure_type.is_empty() && self.verified_status.is_empty()
    }
}

/// A fully-specified search request used internally by the search service.
#[derive(Debug, Clone)]
pub struct SearchQuery {
    pub embedding: Vec<f32>,
    pub origin: Option<(f64, f64)>,
    pub radius_meters: f64,
    pub filters: SearchFilters,
    pub limit: usize,
}

/// A registered user, minus the password hash.
#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct User {
    pub id: Uuid,
    pub email: String,
    pub display_name: String,
}

/// A user-submitted candidate location awaiting review.
#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct Contribution {
    pub id: Uuid,
    pub name: String,
    pub description: String,
    pub lat: f64,
    pub lng: f64,
    pub era: String,
    pub structure_type: String,
    pub image_url: String,
    pub status: String,
}
