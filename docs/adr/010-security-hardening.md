# ADR 010 — Security Hardening for Public Exposure

## Context

The application uses HttpOnly cookie authentication while the production frontend and API are deployed on different origins. The access JWT was previously stateless for its 15-minute lifetime, so deleting a refresh-session record did not invalidate an already-issued access JWT.

The API also had no dedicated CSRF boundary, authentication rate limit, or deliberate HTTP security-header policy.

## Decisions

### Session-bound access JWTs

Each access JWT now contains the MongoDB session identifier that created it. Protected HTTP requests and Socket.IO handshakes require both a valid HS256 JWT and a matching, unexpired server-side session.

Deleting a session therefore invalidates the corresponding access JWT for new protected requests and new socket connections.

### Origin validation for unsafe API methods

Production authentication cookies intentionally use SameSite=None for the existing cross-origin frontend/API topology. Unsafe API methods now require an allowed Origin, or an allowed Referer when Origin is absent.

The same configured origin allowlist is used by Express CORS and Socket.IO.

### Redis-backed authentication throttling

Login and signup are limited to five attempts per normalized credential identity per 15-minute fixed window. Redis evaluates the increment and expiry atomically so the limit works across backend instances. The credential is SHA-256 hashed before becoming part of the Redis key.

The limiter fails closed with HTTP 503 if Redis cannot enforce the control.

### Bounded input and security headers

JSON request bodies are capped at 16 KiB. Authentication fields have explicit maximum lengths. API responses add conservative security headers, and X-Powered-By is disabled.

## Alternatives considered

- Switching production cookies to SameSite=Lax or Strict: rejected because the deployed application currently depends on cross-origin cookie requests.
- Adding a CSRF token package: rejected for this phase because the Origin/Referer boundary is smaller and fits the current browser API topology.
- Adding an external rate-limit dependency: rejected because the existing Redis infrastructure can provide the required distributed counter without another dependency.
- Introducing a JWT blacklist cache: rejected because binding the access JWT to the existing session record provides immediate revocation using the source-of-truth session store.

## Consequences

Protected requests now perform a session lookup in addition to JWT verification. This adds database work to the authenticated request path, but closes the documented revocation gap without creating a second session authority.

Cross-site unsafe requests from untrusted origins now fail with CSRF_BLOCKED. Browser clients from configured origins continue to work.

## Verification

Focused regression tests cover revoked sessions, socket authentication, request-origin enforcement, bounded authentication fields, rate limiting, security headers, and oversized-body error mapping.

Full npm verification remains environment-dependent and must be run in a checkout with the repository's MongoDB, PostgreSQL, and Redis test services available.
