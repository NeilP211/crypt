# ADR 0003 — Build authentication in-house instead of using a SaaS

**Status:** accepted

## Context

Crypt has user accounts: saved locations and a contributor flow. A managed
auth provider (Clerk, Supabase Auth, Auth0) would handle sign-up, sessions,
and tokens.

## Decision

Implement authentication inside the `crypt-server` crate: Argon2id password
hashing, JWT access and refresh tokens, and an axum extractor that gates
protected routes.

## Rationale

- **Self-contained stack.** A SaaS provider needs an external account and
  secret keys, which breaks the "clone and `docker compose up`" guarantee.
  In-house auth keeps the whole system runnable offline.
- **Stronger signal.** For a project meant to demonstrate backend engineering,
  implementing token issuing/verification, password hashing, and middleware
  is more relevant than wiring an SDK.
- **Scope is small.** The requirements — register, login, refresh, route
  guarding — are well understood and modest, with no need for SSO, MFA, or
  social login.

## Consequences

- The `auth` module owns security-sensitive code; it is covered by unit tests
  (hash/verify, token round-trip, expiry, kind confusion, wrong-secret
  rejection).
- Standard, well-reviewed crates do the cryptography: `argon2` for hashing,
  `jsonwebtoken` for JWTs. No cryptographic primitives are hand-rolled.
- A production deployment could still front this with a SaaS provider later;
  the `AuthUser` extractor is the only integration point that would change.
