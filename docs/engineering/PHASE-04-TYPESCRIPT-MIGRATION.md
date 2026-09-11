# Phase 04 — TypeScript Migration

## Status

In progress. This phase is intentionally incremental.

## Repository baseline

The backend started as JavaScript/ESM with explicit route, middleware, controller, service, repository, model, authentication, and Socket.IO boundaries. The frontend remains React/JSX with Context-based authentication/realtime state and Zustand available as a dependency.

## Migration decision

Use TypeScript as an incremental boundary rather than converting every file at once.

The first backend slice establishes:

- strict compiler configuration
- NodeNext ESM semantics compatible with the existing backend
- mixed JS/TS compilation through `allowJs`
- generated declarations and source maps
- an explicit `dist` build target
- typed runtime configuration
- typed API error and request-validation contracts
- typed authentication/session boundaries
- typed user and chat persistence/service/controller boundaries
- typed Socket.IO event payloads

Existing JavaScript remains where it is not yet part of the migrated boundary. This keeps the diff reviewable while allowing the highest-value contracts to become explicit first.

## Why this approach

A whole-repository extension-only conversion would create a large, difficult-to-review diff while preserving weak runtime boundaries. The existing service/repository structure is useful, so the migration strengthens those boundaries instead of replacing them.

The migration order is:

1. compiler/build/runtime foundation
2. error, request, and validation contracts
3. authentication/session contracts
4. user domain/repository/service/controller
5. message/conversation domain/repository/service/controller
6. Socket.IO event contracts and server boundary
7. remaining backend modules
8. shared frontend/backend contracts
9. frontend API/auth/realtime boundaries
10. remaining UI modules

## Dependency strategy

Backend development dependencies now declare TypeScript, `tsx`, Node/Express/HTTP type packages, and JSON Web Token type definitions. The current agent environment cannot reach the npm registry, so `Backend/package-lock.json` has deliberately not been fabricated or hand-edited. The branch therefore requires `npm install` before it can be verified with the new TypeScript scripts.

No runtime framework or ORM is being introduced for TypeScript itself.

## Current migrated boundary

### Runtime/build

- `Backend/tsconfig.json`
- `Backend/index.ts`
- `Backend/config/env.ts`
- `Backend/utils/logger.ts`

The application now has a strict TypeScript entry point and compiled `dist` target. The old JavaScript entry/configuration modules were removed rather than maintaining duplicate entry points.

### Errors and HTTP middleware

- `errors/AppError.ts`
- `errors/errorCodes.ts`
- `middleware/requestContext.ts`
- `middleware/asyncHandler.ts`
- `middleware/validateRequest.ts`
- `middleware/errorHandler.ts`
- `middleware/secureRoute.ts`
- `types/express.d.ts`
- `types/http.ts`

Request IDs, authenticated users, async handlers, validation results, and API error responses now have explicit TypeScript boundaries.

### Authentication and users

- `models/session.model.ts`
- `auth/session.ts`
- `models/user.model.ts`
- `repositories/user.repository.ts`
- `services/user.service.ts`
- `controller/user.controller.ts`
- `routes/user.route.ts`
- `validation/user.schemas.ts`

JWT payloads, session records, public users, registration inputs, and protected request handling are typed. The stable refresh-session behavior from Phase 02 is preserved.

### Chat domain

- `models/message.model.ts`
- `models/conversation.model.ts`
- `repositories/message.repository.ts`
- `repositories/conversation.repository.ts`
- `services/message.service.ts`
- `controller/message.controller.ts`
- `routes/message.route.ts`
- `validation/message.schemas.ts`

Message/conversation persistence and service inputs now use explicit `Types.ObjectId` boundaries instead of passing route strings through the domain layer.

### Realtime

- `SocketIO/events.ts`
- `SocketIO/server.ts`

Socket.IO server-to-client event names and payloads are typed. Message events are serialized into a transport payload rather than emitting a raw Mongoose document.

This does **not** solve socket authentication or distributed presence. The current socket identity remains client-supplied and the in-memory user-to-socket map remains single-instance/single-socket behavior; those are Phase 09/10 concerns.

## API/transport principle

Persistence documents are not treated as frontend contracts. Where the realtime boundary is already migrated, MongoDB `ObjectId` and `Date` values are converted to string representations before emission.

The next shared-contract step should consolidate these DTOs so frontend and backend do not independently redefine the same wire shapes.

## Constraints

- PostgreSQL migration remains Phase 06–07.
- Redis remains Phase 10.
- Kafka/outbox remain Phase 15–16.
- Socket authentication remains Phase 09; this phase types the existing boundary but does not trust client identity.
- Frontend architecture/state refactoring remains Phase 05.
- No visual redesign is part of this phase.

## Quality gates

For each migration slice:

- preserve existing runtime behavior unless intentionally changed
- run TypeScript typecheck after dependencies are installed
- run backend tests through `tsx`
- run frontend lint/build for affected frontend slices
- review generated output and imports for NodeNext correctness
- avoid `any`, `@ts-ignore`, unjustified assertions, and broad compiler suppression

## Verification status

The TypeScript migration branch has not yet been locally typechecked or built by the agent because the environment cannot reach the npm registry to install the newly declared dependencies. No typecheck/build/test success is being claimed.

The known Phase 03 baseline remains the last verified backend result: 17/17 tests passed locally on `main` before this migration branch.
