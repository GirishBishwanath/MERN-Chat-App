# Phase 11 — Security Hardening

## Scope

This phase is a repository-specific security hardening pass for the publicly exposed chat application. It does not introduce Kafka, Outbox processing, Docker, CI/CD, full observability, load testing, GenAI, or cloud infrastructure.

## Findings and mitigations

| Priority | Finding | Root cause | Mitigation | Regression coverage |
|---|---|---|---|---|
| P1 | Revoked refresh sessions did not revoke already-issued access JWTs | Access JWT contained only user identity and was verified statelessly | Bind access JWTs to a server-side session and require an active session on protected requests and socket handshakes | session + socket tests |
| P1 | Cookie-authenticated unsafe requests were exposed to CSRF while production cookies use SameSite=None | Cross-site cookies were required by the current frontend/API topology and there was no Origin/Referer boundary | Require an allowlisted Origin or Referer on POST/PUT/PATCH/DELETE API requests | security middleware tests |
| P1 | Login/signup had no abuse control | No authentication-specific throttling existed | Redis fixed-window rate limit: 5 attempts / 15 minutes per normalized credential identity | rate-limit test |
| P2 | API security headers were not deliberate | Express defaults only | Add nosniff, frame, referrer, permissions policy; HSTS in production; disable X-Powered-By | security middleware test |
| P2 | Authentication input had no upper bounds | Validation checked type/minimums but not maximum sizes | Bound fullname, email, password, confirmation password; cap JSON bodies at 16 KiB | validation + error mapping tests |
| P2 | Socket.IO CORS configuration could drift from API CORS | Hard-coded Socket.IO origin list | Reuse config.corsOrigins | socket regression suite |
| P2 | Frontend request errors were logged verbatim | Debug logging retained full Axios errors | Remove raw request-error logging from user/message hooks | static review |
| P3 | Production configuration could silently fall back to local Redis | Development default was also used in production | Require REDIS_URL in production and require a 32+ character JWT secret | configuration inspection |

## Security properties verified by inspection

- Authentication identity is server-derived from the verified JWT/session, not from client-provided user IDs.
- Message/user rendering inspected in the current frontend uses normal React text rendering; no dangerouslySetInnerHTML or raw HTML insertion was found in the audited chat paths.
- PostgreSQL repository queries use parameterized SQL in the inspected persistence boundary.
- Redis presence keys are built from server-derived user/socket identifiers; presence scripts use Redis arguments rather than string-interpolated Redis commands.
- Passwords and tokens are not written to the structured backend logs inspected during this phase.
- Environment files are ignored and the example environment file contains placeholders rather than credentials.

## CSRF rationale

The production cookies remain HttpOnly, Secure, and SameSite=None because the current frontend/API deployment is cross-origin. SameSite=None permits cross-site cookie transmission, so the API now checks request origin for state-changing methods. The configured CORS allowlist is reused as the trust boundary instead of maintaining a second origin list.

## Rate limiting rationale

The concrete security requirement is protection for public credential endpoints. Redis is already a required Phase 10 dependency and provides a distributed counter without introducing another service. The limiter is intentionally scoped to login and signup rather than every route.

The key is derived from the normalized email and hashed before being stored, avoiding raw credential identifiers in Redis keys. A fixed window is sufficient for the current threat model; a token-bucket or IP reputation system would add complexity not justified by the repository.

## Residual risks

- The login/signup limiter is credential-identity based, not a full IP reputation/abuse system. Password spraying across many identities is not fully prevented.
- Existing connected sockets are authenticated at handshake time. Revocation prevents new connections and protected HTTP requests, but an already-established socket remains connected until its normal disconnect/reconnect lifecycle. The current socket protocol has no client-side mutation event that can bypass REST authorization.
- The production deployment manifest currently does not declare the PostgreSQL/Redis environment required by the current runtime; that is deployment/configuration debt and is outside this security phase.
- Dependency vulnerability state was not re-audited in this environment because npm audit could not be executed from a local checkout.

## Verification status

Repository changes and focused test code were inspected through GitHub. Local npm execution must be completed in the project's normal checkout before this phase is marked runtime-verified.

The implementation should not be described as fully runtime-verified until the project's normal local or CI test environment executes the focused security suite and regression suite.
