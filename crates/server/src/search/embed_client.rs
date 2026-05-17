//! Client for the Python CLIP embedding service.
//!
//! The Rust server does not run a neural network itself. When a user uploads
//! a photo, the bytes are forwarded to the embedding service, which returns a
//! CLIP vector that is then fed into the ANN index.

use serde::Deserialize;

use crate::error::AppError;
use crate::state::AppState;

#[derive(Deserialize)]
struct EmbedResponse {
    embedding: Vec<f32>,
}

/// Embed a raw image by delegating to the embedding service. Returns the CLIP
/// vector, or an `Upstream` error if the service is unreachable or unhealthy.
pub async fn embed_image(
    state: &AppState,
    bytes: Vec<u8>,
    filename: &str,
) -> Result<Vec<f32>, AppError> {
    let part = reqwest::multipart::Part::bytes(bytes).file_name(filename.to_string());
    let form = reqwest::multipart::Form::new().part("file", part);
    let url = format!("{}/embed", state.config.embed_service_url);

    let response = state
        .http
        .post(&url)
        .multipart(form)
        .send()
        .await
        .map_err(|e| AppError::Upstream(format!("embedding service unreachable: {e}")))?;

    if !response.status().is_success() {
        return Err(AppError::Upstream(format!(
            "embedding service returned {}",
            response.status()
        )));
    }

    let body: EmbedResponse = response
        .json()
        .await
        .map_err(|e| AppError::Upstream(format!("invalid embedding service response: {e}")))?;
    Ok(body.embedding)
}
