//! JWT issuing and verification for access and refresh tokens.

use chrono::Utc;
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::AppError;

/// Which kind of token a JWT is. A refresh token cannot be used where an
/// access token is required, and vice versa.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TokenKind {
    Access,
    Refresh,
}

/// JWT payload.
#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    /// Subject — the user id.
    pub sub: String,
    /// Token kind.
    pub kind: TokenKind,
    /// Issued-at (unix seconds).
    pub iat: i64,
    /// Expiry (unix seconds).
    pub exp: i64,
}

/// Holds the symmetric signing key and token lifetimes.
pub struct JwtKeys {
    encoding: EncodingKey,
    decoding: DecodingKey,
    access_ttl: i64,
    refresh_ttl: i64,
}

impl JwtKeys {
    /// Build from a shared secret and token lifetimes (in seconds).
    pub fn new(secret: &str, access_ttl: i64, refresh_ttl: i64) -> Self {
        Self {
            encoding: EncodingKey::from_secret(secret.as_bytes()),
            decoding: DecodingKey::from_secret(secret.as_bytes()),
            access_ttl,
            refresh_ttl,
        }
    }

    /// Issue a signed token of the given kind for a user.
    pub fn issue(&self, user_id: Uuid, kind: TokenKind) -> Result<String, AppError> {
        let now = Utc::now().timestamp();
        let ttl = match kind {
            TokenKind::Access => self.access_ttl,
            TokenKind::Refresh => self.refresh_ttl,
        };
        let claims = Claims {
            sub: user_id.to_string(),
            kind,
            iat: now,
            exp: now + ttl,
        };
        encode(&Header::default(), &claims, &self.encoding)
            .map_err(|e| AppError::Internal(anyhow::anyhow!("jwt encode failed: {e}")))
    }

    /// Verify a token, checking its signature, expiry, and that it is of the
    /// expected kind. Returns the user id on success.
    pub fn verify(&self, token: &str, expected: TokenKind) -> Result<Uuid, AppError> {
        let data = decode::<Claims>(token, &self.decoding, &Validation::default())
            .map_err(|e| AppError::Unauthorized(format!("invalid token: {e}")))?;
        if data.claims.kind != expected {
            return Err(AppError::Unauthorized("wrong token kind".into()));
        }
        Uuid::parse_str(&data.claims.sub)
            .map_err(|_| AppError::Unauthorized("malformed token subject".into()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn access_token_round_trips() {
        let keys = JwtKeys::new("test-secret", 900, 1_000_000);
        let uid = Uuid::new_v4();
        let token = keys.issue(uid, TokenKind::Access).unwrap();
        assert_eq!(keys.verify(&token, TokenKind::Access).unwrap(), uid);
    }

    #[test]
    fn access_token_rejected_as_refresh() {
        let keys = JwtKeys::new("test-secret", 900, 1_000_000);
        let token = keys.issue(Uuid::new_v4(), TokenKind::Access).unwrap();
        assert!(keys.verify(&token, TokenKind::Refresh).is_err());
    }

    #[test]
    fn token_from_other_secret_is_rejected() {
        let issuer = JwtKeys::new("secret-a", 900, 1_000_000);
        let verifier = JwtKeys::new("secret-b", 900, 1_000_000);
        let token = issuer.issue(Uuid::new_v4(), TokenKind::Access).unwrap();
        assert!(verifier.verify(&token, TokenKind::Access).is_err());
    }

    #[test]
    fn expired_token_is_rejected() {
        // Expire an hour ago — well beyond jsonwebtoken's default 60s leeway.
        let keys = JwtKeys::new("test-secret", -3600, -3600);
        let token = keys.issue(Uuid::new_v4(), TokenKind::Access).unwrap();
        assert!(keys.verify(&token, TokenKind::Access).is_err());
    }
}
