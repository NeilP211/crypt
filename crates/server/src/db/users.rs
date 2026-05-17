//! User, saved-location, and contribution queries.

use sqlx::PgPool;
use uuid::Uuid;

use crate::domain::{Contribution, Location, User};

/// Row used when the password hash must be read alongside the user.
#[derive(sqlx::FromRow)]
struct UserRow {
    id: Uuid,
    email: String,
    display_name: String,
    password_hash: String,
}

/// Create a user and return the public projection (no hash).
pub async fn create_user(
    pool: &PgPool,
    email: &str,
    password_hash: &str,
    display_name: &str,
) -> Result<User, sqlx::Error> {
    sqlx::query_as::<_, User>(
        r#"
        INSERT INTO users (email, password_hash, display_name)
        VALUES ($1, $2, $3)
        RETURNING id, email, display_name
        "#,
    )
    .bind(email)
    .bind(password_hash)
    .bind(display_name)
    .fetch_one(pool)
    .await
}

/// Look up a user by email, returning the public projection and the stored
/// password hash for verification.
pub async fn find_by_email(
    pool: &PgPool,
    email: &str,
) -> Result<Option<(User, String)>, sqlx::Error> {
    let row = sqlx::query_as::<_, UserRow>(
        "SELECT id, email, display_name, password_hash FROM users WHERE email = $1",
    )
    .bind(email)
    .fetch_optional(pool)
    .await?;
    Ok(row.map(|r| {
        (
            User {
                id: r.id,
                email: r.email,
                display_name: r.display_name,
            },
            r.password_hash,
        )
    }))
}

/// Look up a user by id.
pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Option<User>, sqlx::Error> {
    sqlx::query_as::<_, User>("SELECT id, email, display_name FROM users WHERE id = $1")
        .bind(id)
        .fetch_optional(pool)
        .await
}

/// Bookmark a location for a user. Idempotent.
pub async fn save_location(
    pool: &PgPool,
    user_id: Uuid,
    location_id: Uuid,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        INSERT INTO saved_locations (user_id, location_id)
        VALUES ($1, $2)
        ON CONFLICT (user_id, location_id) DO NOTHING
        "#,
    )
    .bind(user_id)
    .bind(location_id)
    .execute(pool)
    .await?;
    Ok(())
}

/// Remove a bookmark.
pub async fn unsave_location(
    pool: &PgPool,
    user_id: Uuid,
    location_id: Uuid,
) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM saved_locations WHERE user_id = $1 AND location_id = $2")
        .bind(user_id)
        .bind(location_id)
        .execute(pool)
        .await?;
    Ok(())
}

/// List a user's saved locations, most recently saved first.
pub async fn list_saved(pool: &PgPool, user_id: Uuid) -> Result<Vec<Location>, sqlx::Error> {
    sqlx::query_as::<_, Location>(
        r#"
        SELECT l.id, l.embedding_id, l.name, l.description,
               ST_Y(l.geom::geometry) AS lat,
               ST_X(l.geom::geometry) AS lng,
               l.era, l.structure_type, l.verified_status, l.image_url, l.source
        FROM saved_locations s
        JOIN locations l ON l.id = s.location_id
        WHERE s.user_id = $1
        ORDER BY s.created_at DESC
        "#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await
}

/// Record a user-submitted candidate location.
#[allow(clippy::too_many_arguments)]
pub async fn create_contribution(
    pool: &PgPool,
    user_id: Uuid,
    name: &str,
    description: &str,
    lat: f64,
    lng: f64,
    era: &str,
    structure_type: &str,
    image_url: &str,
) -> Result<Contribution, sqlx::Error> {
    sqlx::query_as::<_, Contribution>(
        r#"
        INSERT INTO contributions
            (user_id, name, description, lat, lng, era, structure_type, image_url)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, name, description, lat, lng, era, structure_type, image_url, status
        "#,
    )
    .bind(user_id)
    .bind(name)
    .bind(description)
    .bind(lat)
    .bind(lng)
    .bind(era)
    .bind(structure_type)
    .bind(image_url)
    .fetch_one(pool)
    .await
}

/// List a user's contributions, newest first.
pub async fn list_contributions(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<Vec<Contribution>, sqlx::Error> {
    sqlx::query_as::<_, Contribution>(
        r#"
        SELECT id, name, description, lat, lng, era, structure_type, image_url, status
        FROM contributions
        WHERE user_id = $1
        ORDER BY created_at DESC
        "#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await
}
