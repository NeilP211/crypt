//! Location queries, including the PostGIS spatial joins used by search.

use sqlx::PgPool;
use uuid::Uuid;

use crate::domain::Location;

/// The set of `Location` columns, with the PostGIS geography projected to
/// plain `lat`/`lng` doubles so `sqlx::FromRow` can decode it.
const LOCATION_COLUMNS: &str = r#"
    id, embedding_id, name, description,
    ST_Y(geom::geometry) AS lat,
    ST_X(geom::geometry) AS lng,
    era, structure_type, verified_status, image_url, source
"#;

/// A candidate row: a location plus its distance from the search origin.
#[derive(sqlx::FromRow)]
struct CandidateRow {
    id: Uuid,
    embedding_id: Option<i32>,
    name: String,
    description: String,
    lat: f64,
    lng: f64,
    era: String,
    structure_type: String,
    verified_status: String,
    image_url: String,
    source: String,
    distance_meters: f64,
}

impl CandidateRow {
    fn split(self) -> (Location, f64) {
        let distance = self.distance_meters;
        (
            Location {
                id: self.id,
                embedding_id: self.embedding_id,
                name: self.name,
                description: self.description,
                lat: self.lat,
                lng: self.lng,
                era: self.era,
                structure_type: self.structure_type,
                verified_status: self.verified_status,
                image_url: self.image_url,
                source: self.source,
            },
            distance,
        )
    }
}

/// Fetch the locations behind a set of HNSW embedding ids, computing each
/// one's great-circle distance from `origin` (or `-1` when no origin given).
///
/// The id set comes from the ANN index, so it is small (a few hundred at
/// most); metadata filtering is applied by the caller in memory.
pub async fn fetch_candidates(
    pool: &PgPool,
    embedding_ids: &[i32],
    origin: Option<(f64, f64)>,
) -> Result<Vec<(Location, f64)>, sqlx::Error> {
    let (lat, lng) = match origin {
        Some((la, ln)) => (Some(la), Some(ln)),
        None => (None, None),
    };
    let sql = format!(
        r#"
        SELECT {LOCATION_COLUMNS},
            CASE
                WHEN $2::double precision IS NULL THEN -1::double precision
                ELSE ST_Distance(geom, ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography)
            END AS distance_meters
        FROM locations
        WHERE embedding_id = ANY($1)
        "#
    );
    let rows = sqlx::query_as::<_, CandidateRow>(&sql)
        .bind(embedding_ids)
        .bind(lat)
        .bind(lng)
        .fetch_all(pool)
        .await?;
    Ok(rows.into_iter().map(CandidateRow::split).collect())
}

/// Fetch a single location by id.
pub async fn fetch_by_id(pool: &PgPool, id: Uuid) -> Result<Option<Location>, sqlx::Error> {
    let sql = format!("SELECT {LOCATION_COLUMNS} FROM locations WHERE id = $1");
    sqlx::query_as::<_, Location>(&sql)
        .bind(id)
        .fetch_optional(pool)
        .await
}

/// Fetch locations whose point falls inside a lat/lng bounding box — the
/// query the map issues as the user pans and zooms.
pub async fn fetch_in_bbox(
    pool: &PgPool,
    min_lat: f64,
    min_lng: f64,
    max_lat: f64,
    max_lng: f64,
    limit: i64,
) -> Result<Vec<Location>, sqlx::Error> {
    let sql = format!(
        r#"
        SELECT {LOCATION_COLUMNS}
        FROM locations
        WHERE geom && ST_MakeEnvelope($1, $2, $3, $4, 4326)::geography
        ORDER BY created_at DESC
        LIMIT $5
        "#
    );
    sqlx::query_as::<_, Location>(&sql)
        .bind(min_lng)
        .bind(min_lat)
        .bind(max_lng)
        .bind(max_lat)
        .bind(limit)
        .fetch_all(pool)
        .await
}

/// Total number of indexed locations.
pub async fn count(pool: &PgPool) -> Result<i64, sqlx::Error> {
    let row: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM locations")
        .fetch_one(pool)
        .await?;
    Ok(row.0)
}
