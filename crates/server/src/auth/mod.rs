//! Authentication: password hashing, JWT issuing/verification, and the
//! request extractor that gates protected routes.

pub mod jwt;
pub mod middleware;
pub mod password;

pub use jwt::{JwtKeys, TokenKind};
pub use middleware::AuthUser;
