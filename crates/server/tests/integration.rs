//! Database integration tests.
//!
//! These require a running PostGIS instance and are therefore marked
//! `#[ignore]` so they do not run in a plain `cargo test`. Run them with:
//!
//! ```text
//! docker compose -f deploy/docker-compose.yml up -d postgres
//! TEST_DATABASE_URL=postgres://crypt:crypt@localhost:5432/crypt \
//!     cargo test -p crypt-server -- --ignored
//! ```

use crypt_server::auth::password;
use crypt_server::db;
use sqlx::PgPool;
use uuid::Uuid;

/// Connect to the test database, applying migrations. Panics with a clear
/// message if `TEST_DATABASE_URL` is unset.
async fn test_pool() -> PgPool {
    let url = std::env::var("TEST_DATABASE_URL")
        .expect("set TEST_DATABASE_URL to run ignored integration tests");
    let pool = db::connect(&url).await.expect("connect to test database");
    db::run_migrations(&pool).await.expect("run migrations");
    pool
}

#[tokio::test]
#[ignore = "requires a running PostGIS instance"]
async fn register_then_authenticate_user() {
    let pool = test_pool().await;
    let email = format!("test-{}@crypt.test", Uuid::new_v4());
    let hash = password::hash_password("a-strong-password").unwrap();

    let created = db::users::create_user(&pool, &email, &hash, "Tester")
        .await
        .expect("create user");
    assert_eq!(created.email, email);

    let (found, stored_hash) = db::users::find_by_email(&pool, &email)
        .await
        .expect("query")
        .expect("user exists");
    assert_eq!(found.id, created.id);
    assert!(password::verify_password("a-strong-password", &stored_hash));
    assert!(!password::verify_password("wrong-password", &stored_hash));
}

#[tokio::test]
#[ignore = "requires a running PostGIS instance"]
async fn save_and_list_locations() {
    let pool = test_pool().await;
    let email = format!("saver-{}@crypt.test", Uuid::new_v4());
    let hash = password::hash_password("a-strong-password").unwrap();
    let user = db::users::create_user(&pool, &email, &hash, "Saver")
        .await
        .expect("create user");

    // Insert a location directly (ingestion normally does this).
    let location_id: Uuid = sqlx::query_scalar(
        r#"
        INSERT INTO locations (name, geom, era, structure_type)
        VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, 'industrial', 'factory')
        RETURNING id
        "#,
    )
    .bind("Test Ruin")
    .bind(-73.95_f64)
    .bind(40.71_f64)
    .fetch_one(&pool)
    .await
    .expect("insert location");

    db::users::save_location(&pool, user.id, location_id)
        .await
        .expect("save");
    // Saving twice must be idempotent.
    db::users::save_location(&pool, user.id, location_id)
        .await
        .expect("save again");

    let saved = db::users::list_saved(&pool, user.id)
        .await
        .expect("list saved");
    assert_eq!(saved.len(), 1);
    assert_eq!(saved[0].id, location_id);
    assert!((saved[0].lat - 40.71).abs() < 1e-6);

    db::users::unsave_location(&pool, user.id, location_id)
        .await
        .expect("unsave");
    let after = db::users::list_saved(&pool, user.id)
        .await
        .expect("list saved");
    assert!(after.is_empty());
}

#[tokio::test]
#[ignore = "requires a running PostGIS instance"]
async fn bbox_query_returns_locations_inside_the_box() {
    let pool = test_pool().await;
    let name = format!("BBox Ruin {}", Uuid::new_v4());
    sqlx::query(
        r#"
        INSERT INTO locations (name, geom)
        VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography)
        "#,
    )
    .bind(&name)
    .bind(2.35_f64)
    .bind(48.85_f64)
    .execute(&pool)
    .await
    .expect("insert location");

    let inside = db::locations::fetch_in_bbox(&pool, 48.0, 2.0, 49.0, 3.0, 100)
        .await
        .expect("bbox query");
    assert!(inside.iter().any(|l| l.name == name));

    let elsewhere = db::locations::fetch_in_bbox(&pool, 0.0, 0.0, 1.0, 1.0, 100)
        .await
        .expect("bbox query");
    assert!(!elsewhere.iter().any(|l| l.name == name));
}
