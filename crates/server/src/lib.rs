//! # crypt-server
//!
//! The Crypt backend: an axum REST API and a tonic gRPC service over a shared
//! hybrid-search core. Search blends a custom HNSW vector index, PostGIS
//! geospatial queries, and metadata ranking, with Redis result caching and
//! Prometheus metrics.

pub mod api;
pub mod auth;
pub mod config;
pub mod db;
pub mod domain;
pub mod error;
pub mod observability;
pub mod search;
pub mod state;

use std::sync::Arc;
use std::time::Duration;

use anyhow::Context;
use hnsw::{HnswConfig, HnswIndex, Metric};

use crate::api::grpc::GrpcSearch;
use crate::auth::JwtKeys;
use crate::config::Config;
use crate::observability::Metrics;
use crate::state::AppState;

/// Load the ANN index from disk, or start with an empty one if no index file
/// exists yet (e.g. before the ingestion pipeline has run).
fn load_index(config: &Config) -> HnswIndex {
    match HnswIndex::load(&config.index_path) {
        Ok(index) => {
            tracing::info!(
                path = %config.index_path,
                vectors = index.len(),
                "loaded ANN index"
            );
            index
        }
        Err(e) => {
            tracing::warn!(
                path = %config.index_path,
                error = %e,
                "no ANN index on disk — starting with an empty index"
            );
            HnswIndex::new(config.embedding_dim, HnswConfig::new(Metric::Cosine))
        }
    }
}

/// Connect to Redis. A failure is non-fatal: the server runs without result
/// caching rather than refusing to start.
async fn connect_redis(url: &str) -> Option<redis::aio::ConnectionManager> {
    let client = match redis::Client::open(url) {
        Ok(client) => client,
        Err(e) => {
            tracing::warn!(error = %e, "invalid REDIS_URL — caching disabled");
            return None;
        }
    };
    match redis::aio::ConnectionManager::new(client).await {
        Ok(manager) => {
            tracing::info!("connected to Redis");
            Some(manager)
        }
        Err(e) => {
            tracing::warn!(error = %e, "Redis unreachable — caching disabled");
            None
        }
    }
}

/// Build application state and run the REST and gRPC servers until shutdown.
pub async fn run() -> anyhow::Result<()> {
    let config = Config::from_env().context("loading configuration")?;
    tracing::info!(
        rest = %config.rest_addr,
        grpc = %config.grpc_addr,
        "starting crypt-server"
    );

    let db = db::connect(&config.database_url)
        .await
        .context("connecting to PostgreSQL")?;
    db::run_migrations(&db)
        .await
        .context("running database migrations")?;
    tracing::info!("database ready");

    let redis = connect_redis(&config.redis_url).await;
    let index = load_index(&config);
    let metrics = Metrics::new();
    metrics.indexed_vectors.set(index.len() as i64);

    let jwt = JwtKeys::new(
        &config.jwt_secret,
        config.access_token_ttl_secs,
        config.refresh_token_ttl_secs,
    );
    let http = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .context("building HTTP client")?;

    let rest_addr = config.rest_addr;
    let grpc_addr = config.grpc_addr;

    let state = AppState {
        config: Arc::new(config),
        db,
        redis,
        index: Arc::new(index),
        jwt: Arc::new(jwt),
        metrics: Arc::new(metrics),
        http,
    };

    // REST server.
    let listener = tokio::net::TcpListener::bind(rest_addr)
        .await
        .with_context(|| format!("binding REST listener on {rest_addr}"))?;
    let rest = async {
        axum::serve(
            listener,
            api::rest::router(state.clone()).into_make_service(),
        )
        .await
        .map_err(anyhow::Error::from)
    };

    // gRPC server.
    let grpc_service = crypt_proto::SearchServiceServer::new(GrpcSearch {
        state: state.clone(),
    });
    let grpc = async {
        tonic::transport::Server::builder()
            .add_service(grpc_service)
            .serve(grpc_addr)
            .await
            .map_err(anyhow::Error::from)
    };

    tracing::info!("crypt-server listening");
    tokio::try_join!(rest, grpc)?;
    Ok(())
}
