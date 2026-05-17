//! Runtime configuration, loaded from environment variables with sane
//! development defaults so the server boots with zero setup.

use std::net::SocketAddr;

/// Hybrid-ranking weights. The three components are normalized to `[0, 1]`
/// before being combined, so the weights need not sum to 1 — they are
/// renormalized internally.
#[derive(Debug, Clone, Copy)]
pub struct RankWeights {
    pub vector: f64,
    pub geo: f64,
    pub metadata: f64,
}

impl Default for RankWeights {
    fn default() -> Self {
        Self {
            vector: 0.6,
            geo: 0.3,
            metadata: 0.1,
        }
    }
}

/// All server configuration.
#[derive(Debug, Clone)]
pub struct Config {
    pub database_url: String,
    pub redis_url: String,
    pub rest_addr: SocketAddr,
    pub grpc_addr: SocketAddr,
    pub jwt_secret: String,
    pub access_token_ttl_secs: i64,
    pub refresh_token_ttl_secs: i64,
    pub index_path: String,
    pub embedding_dim: usize,
    pub embed_service_url: String,
    pub weights: RankWeights,
    pub cache_ttl_secs: u64,
}

fn env_or(key: &str, default: &str) -> String {
    std::env::var(key).unwrap_or_else(|_| default.to_string())
}

fn env_parse<T: std::str::FromStr>(key: &str, default: T) -> T {
    std::env::var(key)
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(default)
}

impl Config {
    /// Build configuration from the process environment.
    pub fn from_env() -> anyhow::Result<Self> {
        let jwt_secret = env_or("JWT_SECRET", "dev-only-insecure-secret-change-me");
        if jwt_secret == "dev-only-insecure-secret-change-me" {
            tracing::warn!("JWT_SECRET is unset — using the insecure development default");
        }

        Ok(Self {
            database_url: env_or(
                "DATABASE_URL",
                "postgres://crypt:crypt@localhost:5432/crypt",
            ),
            redis_url: env_or("REDIS_URL", "redis://localhost:6379"),
            rest_addr: env_or("REST_ADDR", "0.0.0.0:8080").parse()?,
            grpc_addr: env_or("GRPC_ADDR", "0.0.0.0:50051").parse()?,
            jwt_secret,
            access_token_ttl_secs: env_parse("ACCESS_TOKEN_TTL_SECS", 900),
            refresh_token_ttl_secs: env_parse("REFRESH_TOKEN_TTL_SECS", 1_209_600),
            index_path: env_or("INDEX_PATH", "./data/crypt.index"),
            embedding_dim: env_parse("EMBEDDING_DIM", 512),
            embed_service_url: env_or("EMBED_SERVICE_URL", "http://localhost:8000"),
            weights: RankWeights {
                vector: env_parse("WEIGHT_VECTOR", 0.6),
                geo: env_parse("WEIGHT_GEO", 0.3),
                metadata: env_parse("WEIGHT_METADATA", 0.1),
            },
            cache_ttl_secs: env_parse("CACHE_TTL_SECS", 300),
        })
    }
}
