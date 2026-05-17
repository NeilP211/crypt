//! Shared application state, cloned into every request handler.

use std::sync::Arc;

use hnsw::HnswIndex;
use sqlx::PgPool;

use crate::auth::JwtKeys;
use crate::config::Config;
use crate::observability::Metrics;

/// Application state. Every field is cheap to clone (`Arc`, pool handle, or
/// connection manager), so the whole struct is cloned per request.
#[derive(Clone)]
pub struct AppState {
    pub config: Arc<Config>,
    pub db: PgPool,
    /// Redis is optional: if it is unreachable the server still serves
    /// requests, just without result caching.
    pub redis: Option<redis::aio::ConnectionManager>,
    pub index: Arc<HnswIndex>,
    pub jwt: Arc<JwtKeys>,
    pub metrics: Arc<Metrics>,
    pub http: reqwest::Client,
}
