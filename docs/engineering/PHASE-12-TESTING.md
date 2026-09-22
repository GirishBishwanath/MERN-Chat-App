# Phase 12 — Production Testing System

## Scope

Phase 12 establishes a layered automated testing system around the existing PostgreSQL, Redis, Socket.IO, authentication, API, and frontend boundaries. It deliberately does not introduce CI/CD, Docker, Kafka, load testing, cloud infrastructure, or product features.

## Test strategy

| Layer | Tooling | What it proves |
|---|---|---|
| Backend unit | Node node:test | Deterministic validation, auth helpers, middleware, cursor logic, error mapping |
| Backend API/integration | Node node:test + real services | HTTP behavior through middleware/controller/service/repository boundaries |
| Backend PostgreSQL | Node node:test + real PostgreSQL | Migrations, constraints, persistence, transactions, concurrency |
| Backend Redis/realtime | Node node:test + real Redis + Socket.IO clients | Presence, reconnect, authentication, multi-instance fan-out |
| Frontend component/integration | Vitest + React Testing Library | Routing, auth lifecycle, login/signup behavior, realtime context, message/send UI states |
| Browser E2E | Deferred | A reproducible browser lifecycle is not yet established in the repository |

The repository does not add a separate contract-testing framework. Current HTTP and Socket.IO contracts are internal to the TypeScript application and do not yet justify an independently versioned consumer/producer contract platform.

## Backend test contract

From Backend/:

    npm test

npm test is the authoritative backend regression command. It prepares the test database and then runs unit, API/integration, realtime, and security suites in a deterministic sequence.

Focused diagnostic commands:

    npm run test:unit
    npm run test:api
    npm run test:postgres
    npm run test:redis
    npm run test:socket
    npm run test:realtime
    npm run test:security
    npm run test:prepare
    npm run test:coverage

## Frontend test contract

From Frontend/:

    npm test
    npm run test:watch
    npm run typecheck
    npm run build

Vitest runs in jsdom with Testing Library matchers loaded from src/test/setup.ts.

The current frontend suite covers route/auth-state transitions; login and signup flows; session restoration and refresh; authenticated Socket.IO lifecycle; message loading/error/empty behavior; and message composition/send states.

## Isolation and cleanup

- The backend test database is explicitly named mern_chat_app_test.
- npm run test:prepare resets the test schema/tables before a full backend run.
- Destructive migration assertions use an isolated PostgreSQL schema instead of the shared application test database.
- Integration fixtures use synthetic identities and clean up their owned rows.
- Redis integration tests use test-only logical databases and close their clients.
- Socket tests use authenticated synthetic sessions and clean up sockets/users.
- Frontend tests reset mutable state between cases.
- No test uses production credentials or production infrastructure.

## Coverage

Backend coverage is available through npm run test:coverage. Coverage is evidence, not a target percentage. The review priority is authentication/session lifecycle, authorization, persistence invariants, Redis presence, Socket.IO authentication/reconnect behavior, and API validation.

## Verification policy

Phase 12 completion is evidence-driven:

1. npm ci must succeed independently in Backend/ and Frontend/.
2. Backend npm test must pass.
3. Backend coverage must execute successfully.
4. Frontend npm test must pass.
5. Frontend typecheck and production build must pass.
6. The repository must have no accidental test artifacts or credentials.
7. Documentation must describe only testing that is actually implemented.

## Deliberate deferrals

### Browser E2E

Playwright is not included in Phase 12 yet. The repository does not currently provide a stable, reproducible lifecycle for browser startup, backend environment provisioning, test data isolation, and realtime dependency orchestration. Adding Playwright without that lifecycle would create nominal E2E coverage that cannot be trusted.

### CI/CD

GitHub Actions belongs to Phase 14. Phase 12 defines local testing contracts so Phase 14 can automate them.

### Load/performance testing

Load testing belongs to Phase 18 because it requires explicit traffic models, measurements, environment sizing, and reproducible performance baselines.

## Completion assessment

Phase 12 is complete when the repository and local verification satisfy the contract above. The phase is intentionally framework-light: reliable layers and meaningful behavior coverage matter more than maximizing the number of testing tools.
