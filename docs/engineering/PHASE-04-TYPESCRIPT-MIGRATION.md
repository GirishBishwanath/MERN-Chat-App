# Phase 04 — TypeScript Migration

## Status

In progress. This phase is intentionally incremental.

## Repository baseline

The backend is currently JavaScript/ESM and already has explicit route, middleware, controller, service, repository, model, authentication, and Socket.IO boundaries. The frontend is React/JSX with Context-based authentication/realtime state and Zustand available as a dependency.

The backend package currently has no TypeScript compiler or Node type tooling. The frontend has React type packages, but its application source is still JavaScript/JSX.

## Migration decision

Use TypeScript as an incremental boundary rather than converting every file at once.

The first migration slice establishes:

- strict compiler configuration
- NodeNext ESM semantics compatible with the existing backend
- mixed JS/TS compilation through `allowJs`
- generated declarations and source maps
- an explicit `dist` build target
- no relaxation of `strict` mode

Existing JavaScript remains runnable during the migration. This reduces the blast radius while allowing high-value contracts and domain modules to move first.

## Why this approach

A whole-repository extension-only conversion would create a large, difficult-to-review diff while preserving weak runtime boundaries. The current architecture already has useful service/repository separation, so the migration should strengthen those boundaries with explicit types instead of replacing the structure.

The migration order will prioritize:

1. shared domain/API contracts
2. authentication/session contracts
3. validation and error contracts
4. repositories and services
5. controllers/routes
6. Socket.IO event contracts
7. backend entry point/configuration
8. frontend API/auth/realtime boundaries
9. remaining UI modules

## Dependency strategy

TypeScript and required type packages will be added as development dependencies once the package-manager lockfile can be regenerated reliably. The current execution environment cannot reach the npm registry, so the lockfile is deliberately not edited by hand. A manually fabricated lockfile would undermine reproducibility.

No runtime framework or ORM is being introduced for TypeScript itself.

## Constraints

- PostgreSQL migration remains Phase 06–07.
- Redis remains Phase 10.
- Kafka/outbox remain Phase 15–16.
- Socket authentication remains Phase 09; this phase will type the existing boundary but will not treat client-supplied identity as trusted.
- No broad frontend visual redesign is part of this phase.

## Current high-value typing targets

### Authentication

The current session module issues short-lived access JWTs and opaque refresh sessions. Its public boundaries need explicit user-id, session, cookie-response, and JWT payload types. The middleware also needs a typed authenticated request rather than an implicit `req.user` mutation.

### API DTOs

Signup/login inputs, public users, message inputs, and message responses should become explicit transport contracts. Persistence documents should not become API contracts by accident.

### Repositories/services

Repository return values should distinguish hydrated persistence documents from public DTOs. Services should expose business-oriented input/output types and preserve domain invariants.

### Socket.IO

Socket event names and payloads should be represented by a shared event map. This phase will establish the contract; authenticated socket identity and distributed presence are deliberately deferred.

### Frontend

Authentication state should be represented as a discriminated lifecycle (`loading`, `authenticated`, `unauthenticated`) with a typed public-user shape. API and socket payloads should consume the same contract definitions where practical.

## Quality gates

For each migration slice:

- preserve existing runtime behavior unless intentionally changed
- run TypeScript typecheck after dependencies are installed
- run existing backend tests
- run frontend lint/build for affected frontend slices
- review generated output and imports for NodeNext correctness
- avoid `any`, `@ts-ignore`, unjustified assertions, and broad compiler suppression

## Known limitations of the current slice

The repository remains runnable as JavaScript while TypeScript tooling is being introduced. Full typecheck/build verification is pending installation of the compiler/type packages because the current agent environment cannot access npm registry packages.
