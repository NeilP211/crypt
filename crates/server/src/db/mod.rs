//! Database access layer: connection pooling, migrations, and typed queries.

pub mod locations;
pub mod users;

use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;

/// Open a connection pool to PostgreSQL/PostGIS.
pub async fn connect(url: &str) -> anyhow::Result<PgPool> {
    let pool = PgPoolOptions::new()
        .max_connections(10)
        .acquire_timeout(std::time::Duration::from_secs(10))
        .connect(url)
        .await?;
    Ok(pool)
}

/// Apply all pending migrations from the embedded `migrations/` directory.
pub async fn run_migrations(pool: &PgPool) -> anyhow::Result<()> {
    sqlx::migrate!("./migrations").run(pool).await?;
    Ok(())
}
