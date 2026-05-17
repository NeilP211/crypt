//! Database access layer: connection pooling, migrations, and typed queries.

pub mod locations;
pub mod users;

use std::time::Duration;

use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;

/// Open a connection pool to PostgreSQL/PostGIS.
///
/// The database may still be starting up when the server boots (a fresh
/// PostGIS container runs `initdb` first), so connection is retried with a
/// fixed backoff rather than failing fast.
pub async fn connect(url: &str) -> anyhow::Result<PgPool> {
    const MAX_ATTEMPTS: u32 = 15;
    let mut attempt = 0;
    loop {
        attempt += 1;
        let result = PgPoolOptions::new()
            .max_connections(10)
            .acquire_timeout(Duration::from_secs(5))
            .connect(url)
            .await;
        match result {
            Ok(pool) => return Ok(pool),
            Err(e) if attempt < MAX_ATTEMPTS => {
                tracing::warn!(attempt, error = %e, "database not ready, retrying in 3s");
                tokio::time::sleep(Duration::from_secs(3)).await;
            }
            Err(e) => return Err(e.into()),
        }
    }
}

/// Apply all pending migrations from the embedded `migrations/` directory.
pub async fn run_migrations(pool: &PgPool) -> anyhow::Result<()> {
    sqlx::migrate!("./migrations").run(pool).await?;
    Ok(())
}
