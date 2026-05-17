//! REST API: request/response types, handlers, the metrics middleware, and
//! the axum router.

use std::time::Instant;

use axum::extract::{Multipart, Path, Query, Request, State};
use axum::http::{header, StatusCode};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use serde_json::json;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use uuid::Uuid;

use crate::auth::{AuthUser, TokenKind};
use crate::db;
use crate::domain::{Contribution, Location, ScoredLocation, SearchFilters, SearchQuery, User};
use crate::error::{AppError, AppResult};
use crate::search;
use crate::state::AppState;

const DEFAULT_LIMIT: usize = 20;

// --- request / response bodies -------------------------------------------

#[derive(Deserialize)]
struct RegisterRequest {
    email: String,
    password: String,
    #[serde(default)]
    display_name: Option<String>,
}

#[derive(Deserialize)]
struct LoginRequest {
    email: String,
    password: String,
}

#[derive(Deserialize)]
struct RefreshRequest {
    refresh_token: String,
}

#[derive(Serialize)]
struct AuthResponse {
    access_token: String,
    refresh_token: String,
    user: User,
}

#[derive(Deserialize)]
struct GeoOrigin {
    lat: f64,
    lng: f64,
}

#[derive(Deserialize)]
struct SearchRequestBody {
    embedding: Vec<f32>,
    #[serde(default)]
    origin: Option<GeoOrigin>,
    #[serde(default)]
    radius_meters: f64,
    #[serde(default)]
    filters: SearchFilters,
    #[serde(default)]
    limit: Option<usize>,
}

impl SearchRequestBody {
    fn into_query(self) -> SearchQuery {
        SearchQuery {
            embedding: self.embedding,
            origin: self.origin.map(|o| (o.lat, o.lng)),
            radius_meters: self.radius_meters,
            filters: self.filters,
            limit: self.limit.unwrap_or(DEFAULT_LIMIT).clamp(1, 100),
        }
    }
}

#[derive(Deserialize)]
struct BboxQuery {
    min_lat: f64,
    min_lng: f64,
    max_lat: f64,
    max_lng: f64,
    #[serde(default)]
    limit: Option<i64>,
}

#[derive(Deserialize)]
struct ContributeRequest {
    name: String,
    #[serde(default)]
    description: String,
    lat: f64,
    lng: f64,
    #[serde(default = "unknown")]
    era: String,
    #[serde(default = "unknown")]
    structure_type: String,
    #[serde(default)]
    image_url: String,
}

fn unknown() -> String {
    "unknown".to_string()
}

// --- auth handlers --------------------------------------------------------

fn issue_tokens(state: &AppState, user: User) -> AppResult<AuthResponse> {
    Ok(AuthResponse {
        access_token: state.jwt.issue(user.id, TokenKind::Access)?,
        refresh_token: state.jwt.issue(user.id, TokenKind::Refresh)?,
        user,
    })
}

async fn register(
    State(state): State<AppState>,
    Json(req): Json<RegisterRequest>,
) -> AppResult<Json<AuthResponse>> {
    if req.password.len() < 8 {
        return Err(AppError::BadRequest(
            "password must be at least 8 characters".into(),
        ));
    }
    let email = req.email.trim().to_lowercase();
    if !email.contains('@') || email.len() < 3 {
        return Err(AppError::BadRequest("invalid email address".into()));
    }
    let hash = crate::auth::password::hash_password(&req.password)?;
    let display_name = req.display_name.unwrap_or_default();
    let user = db::users::create_user(&state.db, &email, &hash, &display_name)
        .await
        .map_err(|e| match e {
            sqlx::Error::Database(db_err) if db_err.is_unique_violation() => {
                AppError::Conflict("email already registered".into())
            }
            other => AppError::Database(other),
        })?;
    Ok(Json(issue_tokens(&state, user)?))
}

async fn login(
    State(state): State<AppState>,
    Json(req): Json<LoginRequest>,
) -> AppResult<Json<AuthResponse>> {
    let email = req.email.trim().to_lowercase();
    let found = db::users::find_by_email(&state.db, &email).await?;
    let (user, hash) =
        found.ok_or_else(|| AppError::Unauthorized("invalid credentials".into()))?;
    if !crate::auth::password::verify_password(&req.password, &hash) {
        return Err(AppError::Unauthorized("invalid credentials".into()));
    }
    Ok(Json(issue_tokens(&state, user)?))
}

async fn refresh(
    State(state): State<AppState>,
    Json(req): Json<RefreshRequest>,
) -> AppResult<Json<AuthResponse>> {
    let user_id = state.jwt.verify(&req.refresh_token, TokenKind::Refresh)?;
    let user = db::users::find_by_id(&state.db, user_id)
        .await?
        .ok_or(AppError::NotFound)?;
    Ok(Json(issue_tokens(&state, user)?))
}

async fn me(State(state): State<AppState>, AuthUser(user_id): AuthUser) -> AppResult<Json<User>> {
    let user = db::users::find_by_id(&state.db, user_id)
        .await?
        .ok_or(AppError::NotFound)?;
    Ok(Json(user))
}

// --- search handlers ------------------------------------------------------

async fn search_json(
    State(state): State<AppState>,
    Json(req): Json<SearchRequestBody>,
) -> AppResult<Json<Vec<ScoredLocation>>> {
    let results = search::run_search(&state, req.into_query()).await?;
    Ok(Json(results))
}

/// Split a comma-separated multipart text field into a filter list.
fn split_filter(raw: &str) -> Vec<String> {
    raw.split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect()
}

async fn search_image(
    State(state): State<AppState>,
    mut multipart: Multipart,
) -> AppResult<Json<Vec<ScoredLocation>>> {
    let mut image: Option<(String, Vec<u8>)> = None;
    let mut lat: Option<f64> = None;
    let mut lng: Option<f64> = None;
    let mut radius_meters = 0.0;
    let mut filters = SearchFilters::default();
    let mut limit = DEFAULT_LIMIT;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| AppError::BadRequest(format!("invalid multipart body: {e}")))?
    {
        let name = field.name().unwrap_or_default().to_string();
        match name.as_str() {
            "file" | "image" => {
                let filename = field.file_name().unwrap_or("upload").to_string();
                let bytes = field
                    .bytes()
                    .await
                    .map_err(|e| AppError::BadRequest(format!("could not read image: {e}")))?;
                image = Some((filename, bytes.to_vec()));
            }
            "lat" => lat = field.text().await.ok().and_then(|t| t.parse().ok()),
            "lng" => lng = field.text().await.ok().and_then(|t| t.parse().ok()),
            "radius_meters" => {
                radius_meters = field
                    .text()
                    .await
                    .ok()
                    .and_then(|t| t.parse().ok())
                    .unwrap_or(0.0);
            }
            "limit" => {
                limit = field
                    .text()
                    .await
                    .ok()
                    .and_then(|t| t.parse().ok())
                    .unwrap_or(DEFAULT_LIMIT);
            }
            "era" => filters.era = split_filter(&field.text().await.unwrap_or_default()),
            "structure_type" => {
                filters.structure_type = split_filter(&field.text().await.unwrap_or_default())
            }
            "verified_status" => {
                filters.verified_status = split_filter(&field.text().await.unwrap_or_default())
            }
            _ => {}
        }
    }

    let (filename, bytes) =
        image.ok_or_else(|| AppError::BadRequest("missing 'file' image field".into()))?;
    let embedding = search::embed_client::embed_image(&state, bytes, &filename).await?;
    let origin = match (lat, lng) {
        (Some(a), Some(b)) => Some((a, b)),
        _ => None,
    };
    let query = SearchQuery {
        embedding,
        origin,
        radius_meters,
        filters,
        limit: limit.clamp(1, 100),
    };
    Ok(Json(search::run_search(&state, query).await?))
}

// --- location handlers ----------------------------------------------------

async fn get_location(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<Location>> {
    let location = db::locations::fetch_by_id(&state.db, id)
        .await?
        .ok_or(AppError::NotFound)?;
    Ok(Json(location))
}

async fn list_locations(
    State(state): State<AppState>,
    Query(bbox): Query<BboxQuery>,
) -> AppResult<Json<Vec<Location>>> {
    let limit = bbox.limit.unwrap_or(500).clamp(1, 2000);
    let locations = db::locations::fetch_in_bbox(
        &state.db,
        bbox.min_lat,
        bbox.min_lng,
        bbox.max_lat,
        bbox.max_lng,
        limit,
    )
    .await?;
    Ok(Json(locations))
}

// --- user library handlers ------------------------------------------------

async fn list_saved(
    State(state): State<AppState>,
    AuthUser(user_id): AuthUser,
) -> AppResult<Json<Vec<Location>>> {
    Ok(Json(db::users::list_saved(&state.db, user_id).await?))
}

async fn save_location(
    State(state): State<AppState>,
    AuthUser(user_id): AuthUser,
    Path(location_id): Path<Uuid>,
) -> AppResult<StatusCode> {
    db::users::save_location(&state.db, user_id, location_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn unsave_location(
    State(state): State<AppState>,
    AuthUser(user_id): AuthUser,
    Path(location_id): Path<Uuid>,
) -> AppResult<StatusCode> {
    db::users::unsave_location(&state.db, user_id, location_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn contribute(
    State(state): State<AppState>,
    AuthUser(user_id): AuthUser,
    Json(req): Json<ContributeRequest>,
) -> AppResult<Json<Contribution>> {
    if req.name.trim().is_empty() {
        return Err(AppError::BadRequest("name is required".into()));
    }
    if !(-90.0..=90.0).contains(&req.lat) || !(-180.0..=180.0).contains(&req.lng) {
        return Err(AppError::BadRequest("coordinates out of range".into()));
    }
    let contribution = db::users::create_contribution(
        &state.db,
        user_id,
        req.name.trim(),
        &req.description,
        req.lat,
        req.lng,
        &req.era,
        &req.structure_type,
        &req.image_url,
    )
    .await?;
    Ok(Json(contribution))
}

async fn list_contributions(
    State(state): State<AppState>,
    AuthUser(user_id): AuthUser,
) -> AppResult<Json<Vec<Contribution>>> {
    Ok(Json(db::users::list_contributions(&state.db, user_id).await?))
}

// --- operational handlers -------------------------------------------------

async fn health(State(state): State<AppState>) -> Json<serde_json::Value> {
    Json(json!({
        "status": "ok",
        "indexed_vectors": state.index.len(),
    }))
}

async fn metrics(State(state): State<AppState>) -> Response {
    (
        [(header::CONTENT_TYPE, "text/plain; version=0.0.4")],
        state.metrics.render(),
    )
        .into_response()
}

// --- metrics middleware ---------------------------------------------------

/// Collapse high-cardinality path segments (UUIDs) so metric labels stay
/// bounded — e.g. `/api/locations/<uuid>` becomes `/api/locations/:id`.
fn normalize_route(path: &str) -> String {
    let normalized: Vec<&str> = path
        .split('/')
        .map(|seg| {
            if Uuid::parse_str(seg).is_ok() {
                ":id"
            } else {
                seg
            }
        })
        .collect();
    normalized.join("/")
}

async fn track_metrics(State(state): State<AppState>, req: Request, next: Next) -> Response {
    let route = normalize_route(req.uri().path());
    let started = Instant::now();
    let response = next.run(req).await;
    let status = response.status().as_u16().to_string();
    state
        .metrics
        .http_requests
        .with_label_values(&[&route, &status])
        .inc();
    state
        .metrics
        .http_latency
        .with_label_values(&[&route])
        .observe(started.elapsed().as_secs_f64());
    response
}

// --- router ---------------------------------------------------------------

/// Build the REST router with all routes, middleware, and shared state.
pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/api/health", get(health))
        .route("/metrics", get(metrics))
        .route("/api/auth/register", post(register))
        .route("/api/auth/login", post(login))
        .route("/api/auth/refresh", post(refresh))
        .route("/api/auth/me", get(me))
        .route("/api/search", post(search_json))
        .route("/api/search/image", post(search_image))
        .route("/api/locations", get(list_locations))
        .route("/api/locations/:id", get(get_location))
        .route("/api/saved", get(list_saved))
        .route(
            "/api/saved/:id",
            post(save_location).delete(unsave_location),
        )
        .route("/api/contribute", post(contribute))
        .route("/api/contributions", get(list_contributions))
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            track_metrics,
        ))
        .layer(TraceLayer::new_for_http())
        .layer(CorsLayer::permissive())
        .with_state(state)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn route_normalization_collapses_uuids() {
        let uuid = Uuid::new_v4();
        assert_eq!(
            normalize_route(&format!("/api/locations/{uuid}")),
            "/api/locations/:id"
        );
        assert_eq!(normalize_route("/api/search"), "/api/search");
    }

    #[test]
    fn split_filter_trims_and_drops_empties() {
        assert_eq!(split_filter("factory, hospital ,"), vec!["factory", "hospital"]);
        assert!(split_filter("  ").is_empty());
    }
}
