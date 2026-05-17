//! The unified error type for the server and its HTTP representation.

use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde_json::json;

/// Every fallible request handler returns this. It maps cleanly to both an
/// HTTP status + JSON body and a gRPC status.
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("not found")]
    NotFound,

    #[error("unauthorized: {0}")]
    Unauthorized(String),

    #[error("bad request: {0}")]
    BadRequest(String),

    #[error("conflict: {0}")]
    Conflict(String),

    #[error("upstream service error: {0}")]
    Upstream(String),

    #[error(transparent)]
    Database(#[from] sqlx::Error),

    #[error(transparent)]
    Internal(#[from] anyhow::Error),
}

/// Convenient result alias for handlers.
pub type AppResult<T> = Result<T, AppError>;

impl AppError {
    /// The HTTP status this error maps to.
    pub fn status(&self) -> StatusCode {
        match self {
            AppError::NotFound => StatusCode::NOT_FOUND,
            AppError::Unauthorized(_) => StatusCode::UNAUTHORIZED,
            AppError::BadRequest(_) => StatusCode::BAD_REQUEST,
            AppError::Conflict(_) => StatusCode::CONFLICT,
            AppError::Upstream(_) => StatusCode::BAD_GATEWAY,
            AppError::Database(sqlx::Error::RowNotFound) => StatusCode::NOT_FOUND,
            AppError::Database(_) | AppError::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let status = self.status();
        // Internal errors are logged in full but never leaked to the client.
        let message = match &self {
            AppError::Database(e) if status == StatusCode::INTERNAL_SERVER_ERROR => {
                tracing::error!(error = %e, "database error");
                "internal server error".to_string()
            }
            AppError::Internal(e) => {
                tracing::error!(error = %e, "internal error");
                "internal server error".to_string()
            }
            other => other.to_string(),
        };
        (status, Json(json!({ "error": message }))).into_response()
    }
}

impl From<AppError> for tonic::Status {
    fn from(err: AppError) -> Self {
        let msg = err.to_string();
        match err.status() {
            StatusCode::NOT_FOUND => tonic::Status::not_found(msg),
            StatusCode::UNAUTHORIZED => tonic::Status::unauthenticated(msg),
            StatusCode::BAD_REQUEST => tonic::Status::invalid_argument(msg),
            StatusCode::CONFLICT => tonic::Status::already_exists(msg),
            StatusCode::BAD_GATEWAY => tonic::Status::unavailable(msg),
            _ => tonic::Status::internal("internal server error"),
        }
    }
}
