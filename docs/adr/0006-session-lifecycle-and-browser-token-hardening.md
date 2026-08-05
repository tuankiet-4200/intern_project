# ADR 0006: Session Lifecycle And Browser Token Hardening

Date: 2026-08-05

Status: accepted

## Context

Opaque refresh sessions rotate safely but expired and revoked rows accumulated indefinitely. A periodic job can run in every API replica, so an unconstrained delete would create duplicate database work and long transactions.

The Web application also persisted the access JWT and safe user in localStorage. A script running through XSS could read that token after navigation or browser restart. Moving the token to memory reduces its persistence, but page reload must still recover without forcing a login while the HttpOnly refresh cookie is valid.

Next.js 16 supports nonce CSP through a dynamic Proxy path, but current official guidance marks the App Router nonce/SRI integrations experimental and webpack-only. This project uses Turbopack and statically generated workflow pages.

## Decision

- Run cleanup inside the Auth bounded context at bootstrap and on a configurable interval.
- Retain expired/revoked session rows for a configurable investigation window, then delete them in bounded batches.
- Acquire a PostgreSQL transaction advisory lock before cleanup so only one API replica executes cleanup at a time.
- Select candidates with `FOR UPDATE SKIP LOCKED`, cap batch size/run count and keep cleanup failures non-fatal to application startup.
- Store access JWT and safe user only in module memory. Never read the old localStorage payload; remove its legacy key whenever the session helper runs.
- When a protected request has no memory token, call `/auth/refresh` using the HttpOnly cookie, store the returned access token in memory and continue the request.
- Share one module-level refresh promise across concurrent requests and retry a failed protected request at most once.
- Apply a static CSP/security-header baseline through Next configuration, including an explicit API `connect-src`, no objects, no framing and no unsafe eval in production.
- Retain static Turbopack generation for now and document the remaining `unsafe-inline` CSP limitation instead of switching the whole application to experimental webpack/nonces or dynamic rendering.

## Consequences

Positive:

- Session-table growth is bounded without deleting recent evidence or allowing replicas to delete concurrently.
- Refresh tokens remain HttpOnly and access tokens no longer survive reload/browser restart in script-readable storage.
- Reload and concurrent API calls remain usable through refresh rotation and deduplication.
- CSP blocks unexpected external connections, plugins, framing and most third-party script sources.

Trade-offs:

- An active XSS payload can still access the current in-memory token; output encoding, dependency review and CSP remain necessary.
- Static Next.js/Turbopack currently requires `unsafe-inline` for framework scripts/styles, so this is not a strict nonce CSP.
- Refresh-cookie validity now determines whether a reload transparently restores a session, increasing the importance of cookie, CORS and rotation correctness.
- PostgreSQL-specific advisory locking is an intentional infrastructure dependency for this maintenance job.
