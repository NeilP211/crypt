//! Observability: structured tracing and Prometheus metrics.
//!
//! Logs are emitted as structured records via `tracing`. Operational metrics
//! are exposed in Prometheus text format at `GET /metrics`, which the bundled
//! Prometheus instance scrapes and Grafana visualizes.

use prometheus::{
    Encoder, Histogram, HistogramOpts, HistogramVec, IntCounter, IntCounterVec, IntGauge, Opts,
    Registry, TextEncoder,
};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

/// Initialize the global tracing subscriber. Honors `RUST_LOG`; defaults to
/// `info`. Emits compact human-readable logs unless `LOG_FORMAT=json`.
pub fn init_tracing() {
    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));
    let registry = tracing_subscriber::registry().with(filter);
    if std::env::var("LOG_FORMAT").as_deref() == Ok("json") {
        registry
            .with(tracing_subscriber::fmt::layer().json())
            .init();
    } else {
        registry
            .with(tracing_subscriber::fmt::layer().compact())
            .init();
    }
}

/// All Prometheus metrics, registered into one registry.
pub struct Metrics {
    pub registry: Registry,
    /// HTTP requests, labeled by route and status class.
    pub http_requests: IntCounterVec,
    /// HTTP request duration in seconds, labeled by route.
    pub http_latency: HistogramVec,
    /// End-to-end search duration in seconds.
    pub search_latency: Histogram,
    /// Search-result cache hits.
    pub cache_hits: IntCounter,
    /// Search-result cache misses.
    pub cache_misses: IntCounter,
    /// Number of vectors currently in the ANN index.
    pub indexed_vectors: IntGauge,
}

impl Metrics {
    /// Construct and register every metric. Panics only on a programmer error
    /// (duplicate metric name), which would be caught immediately in tests.
    pub fn new() -> Self {
        let registry = Registry::new();

        let http_requests = IntCounterVec::new(
            Opts::new("crypt_http_requests_total", "Total HTTP requests"),
            &["route", "status"],
        )
        .unwrap();
        let http_latency = HistogramVec::new(
            HistogramOpts::new("crypt_http_latency_seconds", "HTTP request latency"),
            &["route"],
        )
        .unwrap();
        let search_latency = Histogram::with_opts(HistogramOpts::new(
            "crypt_search_latency_seconds",
            "End-to-end hybrid search latency",
        ))
        .unwrap();
        let cache_hits = IntCounter::new("crypt_cache_hits_total", "Search cache hits").unwrap();
        let cache_misses =
            IntCounter::new("crypt_cache_misses_total", "Search cache misses").unwrap();
        let indexed_vectors =
            IntGauge::new("crypt_indexed_vectors", "Vectors in the ANN index").unwrap();

        registry.register(Box::new(http_requests.clone())).unwrap();
        registry.register(Box::new(http_latency.clone())).unwrap();
        registry.register(Box::new(search_latency.clone())).unwrap();
        registry.register(Box::new(cache_hits.clone())).unwrap();
        registry.register(Box::new(cache_misses.clone())).unwrap();
        registry
            .register(Box::new(indexed_vectors.clone()))
            .unwrap();

        Self {
            registry,
            http_requests,
            http_latency,
            search_latency,
            cache_hits,
            cache_misses,
            indexed_vectors,
        }
    }

    /// Render all metrics in Prometheus text exposition format.
    pub fn render(&self) -> String {
        let mut buffer = Vec::new();
        let encoder = TextEncoder::new();
        let families = self.registry.gather();
        encoder.encode(&families, &mut buffer).ok();
        String::from_utf8(buffer).unwrap_or_default()
    }
}

impl Default for Metrics {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn metrics_register_and_render() {
        let m = Metrics::new();
        m.cache_hits.inc();
        m.indexed_vectors.set(42);
        let out = m.render();
        assert!(out.contains("crypt_cache_hits_total"));
        assert!(out.contains("crypt_indexed_vectors 42"));
    }
}
