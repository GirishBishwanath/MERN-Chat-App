# ADR 012 — Layered Testing Architecture

## Status

Accepted

## Context

The backend already has useful Node `node:test` suites for authentication, PostgreSQL, Redis, Socket.IO, validation, and security. However, the repository lacked a single authoritative test command, HTTP API integration coverage, frontend automated tests, browser E2E, and an explicit isolation strategy.

The application uses real PostgreSQL and Redis for behavior where their semantics matter.

## Decision

1. Retain Node's built-in `node:test` for backend unit, integration, security, and realtime suites.
2. Add HTTP API integration tests against the Express application without starting the production listener.
3. Run PostgreSQL and Redis integration suites with controlled test concurrency.
4. Keep Redis test state explicitly separated by Redis database where multiple infrastructure instances are involved.
5. Make `npm test` the authoritative backend test command and keep focused commands for diagnosis.
6. Use Vitest + React Testing Library for frontend component/state testing when the frontend lockfile can be regenerated and verified by the normal npm toolchain.
7. Use Playwright for a small set of deterministic browser workflows once the frontend E2E environment is available.
8. Do not introduce a dedicated contract-testing framework until an independently versioned producer/consumer boundary justifies it.
9. Do not impose an arbitrary coverage percentage.

## Alternatives considered

### Replace backend tests with Jest/Vitest

Rejected. The existing Node test runner already supports the backend's current unit, database, Redis, and Socket.IO requirements. Replacing it would create migration work without solving a demonstrated problem.

### Mock PostgreSQL/Redis

Rejected. The important behavior includes constraints, transactions, TTLs, atomic Redis operations, and distributed Socket.IO semantics. Mocking those systems would test our mocks rather than the application's infrastructure assumptions.

### Large browser E2E suite

Rejected. Browser tests are expensive and timing-sensitive. A small set of high-value workflows provides better maintenance characteristics.

## Consequences

Positive:
- one predictable backend verification command;
- real infrastructure semantics remain covered;
- API behavior is tested across the real middleware/controller/service/repository boundary;
- future regressions are easier to localize.

Tradeoffs:
- PostgreSQL and Redis are required for integration/realtime tests;
- frontend and browser test tooling add dependencies and local setup;
- E2E remains intentionally small.

## Deferred

Frontend component tests, Playwright E2E, and coverage reporting remain explicit Phase 12 work items requiring synchronized dependency lockfiles and actual runtime verification in the normal local checkout.
