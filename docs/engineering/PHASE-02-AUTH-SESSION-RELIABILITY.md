# Phase 02 — Production Auth & Session Reliability

Repository: `GirishBishwanath/MERN-Chat-App`

Branch: `main`

## Scope

This phase fixes the P0/P1 authentication/session defects identified by the forensic audit while keeping MongoDB, JavaScript, Redis, Kafka, and the existing Socket.IO architecture otherwise unchanged.

## Design decision

Authentication is now server-authoritative:

- The browser does not read authentication cookies.
- Access credentials are short-lived JWTs stored in an HttpOnly cookie.
- Refresh credentials are opaque random tokens stored in an HttpOnly cookie.
- Only a SHA-256 hash of each refresh token is persisted in MongoDB.
- Refresh sessions expire after 30 days and are revocable server-side.
- The refresh token remains stable during its session to avoid refresh races between browser tabs/devices; the access JWT is replaced on refresh.
- `/api/user/me` restores the authenticated user from the server-side access credential.
- Logout revokes the current refresh session and clears authentication cookies.
- Logout-all-devices deletes all refresh sessions for the authenticated user.
- Frontend auth state is explicitly `loading`, `authenticated`, or `unauthenticated`.
- Axios performs a single shared refresh request when concurrent API calls encounter an expired access token.

### Why this design

A single long-lived JWT cannot provide practical server-side revocation. A DB-backed refresh session gives the server a revocable credential without exposing a bearer token to JavaScript. Short-lived access tokens reduce the lifetime of a stolen access credential while a persistent refresh session provides a usable login lifecycle.

Refresh-token rotation was intentionally not introduced in this phase because a shared browser cookie can be refreshed concurrently by multiple tabs. Rotation without a reuse/grace mechanism would create avoidable session invalidation races. A future security-hardening phase can evaluate token-family rotation and reuse detection if the threat model justifies the added complexity.

Redis was deliberately not introduced: session state is security-sensitive and the current application has no demonstrated need for distributed ephemeral session storage. PostgreSQL migration remains Phase 06/07.

## Changes

### Backend

- Added `Backend/models/session.model.js` for persistent refresh sessions and TTL expiry.
- Added `Backend/auth/session.js` for access-token issuance, refresh-session lookup, hashing, revocation, and cookie policy.
- Updated authentication controllers for normalized emails, safe nonexistent-user handling, session creation, `/api/user/me`, refresh, logout, and logout-all.
- Updated `secureRoute` to authenticate from the short-lived `accessToken` HttpOnly cookie and return 401 for invalid/expired credentials.
- Added `/api/user/me`, `/api/user/refresh`, and `/api/user/logout-all`.
- Removed the obsolete JWT helper that supported the conflicting `JWT_TOKEN`/`JWT_SECRET` configuration.
- Canonicalized authentication configuration on `JWT_SECRET` and fail fast when required backend configuration is missing.
- Backend startup now awaits MongoDB connection before accepting traffic.
- User passwords are excluded from normal queries and `confirmPassword` is no longer part of the user schema.

### Frontend

- Removed localStorage and JavaScript-cookie authentication as sources of truth.
- Added server-backed auth restoration using `/api/user/me` and refresh.
- Added explicit authentication lifecycle state.
- Added an Axios response interceptor that performs a single shared refresh request for concurrent 401 responses.
- Login/signup now rely on server-set HttpOnly cookies rather than persisting authentication data in localStorage.
- Logout revokes the server-side session and updates local auth state without a page reload.
- Removed authentication-cookie reads and Authorization headers from the users hook.
- Updated message rendering and socket context to consume the new auth-user shape.

### Tests

Added Node's built-in test runner coverage for:

- valid access tokens
- expired access tokens
- missing protected-session credentials
- valid protected-session authentication
- cookie clearing
- nonexistent login users
- invalid passwords
- successful login session creation
- successful signup session creation
- malformed signup input
- password mismatch
- duplicate signup
- logout session revocation

## Security properties

- Authentication cookies are HttpOnly.
- Production cookies use Secure + SameSite=None for the existing cross-origin deployment model.
- Local development uses Secure=false + SameSite=Lax for HTTP localhost.
- Refresh tokens are not stored in plaintext in MongoDB.
- Password confirmation is not persisted.
- Authentication failures return 401 rather than server errors for invalid credentials/session tokens.
- JWT signing and verification use the same canonical `JWT_SECRET` configuration.

## Verification status

The repository was inspected and the implementation was committed directly to `main` through the GitHub repository integration.

A local clone/test execution was attempted in the current execution environment, but outbound access to `github.com` is unavailable. Therefore no claim is made that `npm test`, frontend lint, or frontend build has passed in this environment.

The backend test command is now:

```bash
cd Backend
npm test
```

which runs:

```text
node --test auth/*.test.js
```

## Remaining auth risks / follow-up

Phase 02 intentionally does not introduce rate limiting, distributed session infrastructure, authenticated Socket.IO handshakes, or full CSRF/security middleware. Those concerns belong to later roadmap phases where their operational and architectural requirements can be addressed deliberately.

The current Socket.IO implementation still trusts a client-provided user ID during its handshake. This is a known Phase 09 issue and must not be interpreted as fixed by the HTTP authentication work in this phase.

The current test suite is regression-focused and does not yet provide a full MongoDB-backed HTTP integration environment. That broader testing system is planned for Phase 12.

The repository's current `main` branch is the source of truth for the implementation state.
