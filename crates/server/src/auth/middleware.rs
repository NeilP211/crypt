//! Axum extractor that authenticates a request from its `Authorization`
//! header. A handler that takes an [`AuthUser`] argument is automatically
//! gated — unauthenticated requests are rejected before the handler runs.

use axum::extract::FromRequestParts;
use axum::http::header::AUTHORIZATION;
use axum::http::request::Parts;

use crate::auth::jwt::TokenKind;
use crate::error::AppError;
use crate::state::AppState;

/// The authenticated user's id, extracted from a valid bearer access token.
pub struct AuthUser(pub uuid::Uuid);

#[axum::async_trait]
impl FromRequestParts<AppState> for AuthUser {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let header = parts
            .headers
            .get(AUTHORIZATION)
            .and_then(|v| v.to_str().ok())
            .ok_or_else(|| AppError::Unauthorized("missing Authorization header".into()))?;

        let token = header
            .strip_prefix("Bearer ")
            .ok_or_else(|| AppError::Unauthorized("expected a Bearer token".into()))?;

        let user_id = state.jwt.verify(token, TokenKind::Access)?;
        Ok(AuthUser(user_id))
    }
}
