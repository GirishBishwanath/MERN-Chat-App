# Phase 03 — Backend Architecture / Error / Validation Foundation

## Problem
The backend previously combined request validation, persistence, business logic, error handling, and HTTP response decisions inside controllers. Failures were handled inconsistently and several API responses used incorrect status codes.

## Decision
Introduce only the boundaries that have real responsibilities:

```text
route → middleware → controller → service → repository → MongoDB
```

- Routes compose authentication, validation, and async error handling.
- Controllers translate validated HTTP input into service calls and shape successful responses.
- Services enforce business invariants.
- Repositories own Mongoose persistence calls.
- A single error middleware maps known failures to stable `{ error, code, requestId }` responses.

MongoDB remains the database in this phase. PostgreSQL migration is intentionally deferred to Phase 06/07.

## Validation
External request input is validated before controllers execute for signup, login, send-message, and get-message routes. Service-level checks retain important domain invariants so business logic is not dependent on a particular HTTP entry point.

## Error contract
Stable error codes are defined in `Backend/errors/errorCodes.js`. The error handler maps validation, cast, duplicate-key, JWT, CORS, and application errors to appropriate HTTP statuses.

## Observability
A lightweight structured JSON logger records request method, path, status, duration, and request ID without request bodies or credentials. `X-Request-Id` is accepted or generated and returned on the response.

## Operational endpoints
- `GET /health/live` — process liveness; does not require MongoDB.
- `GET /health/ready` — readiness based on the MongoDB connection state; returns `503` while unavailable.

Startup now validates configuration before opening the listener, awaits MongoDB connection, and exits on startup failure. SIGINT/SIGTERM close the HTTP server and MongoDB connection.

## HTTP semantics corrected
- collection GETs return `200`
- successful creation returns `201`
- successful logout returns `204`
- authentication failures return `401`
- forbidden requests return `403`
- missing resources return `404`
- duplicate resources return `409`
- validation failures return `400`

## Testing
Added coverage for request validation and centralized error mapping. Existing authentication controller tests were adjusted for the conflict status contract.

Local execution remains the source of truth for final verification. Do not claim tests/builds passed unless their command output is available.

## Remaining debt
- TypeScript and shared typed contracts are Phase 04.
- Message transactions and cursor pagination are Phase 06–08.
- Server-authoritative Socket.IO authentication is Phase 09.
- Rate limiting/security hardening is Phase 11.
- Full integration/E2E testing is Phase 12.
