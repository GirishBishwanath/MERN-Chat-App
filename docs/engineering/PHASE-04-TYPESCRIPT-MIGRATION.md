# Phase 04 — TypeScript Migration

## Status

In progress. Source migration is substantially complete; final verification remains blocked until the declared dependencies can be installed in an environment with npm registry access.

## Repository baseline

The backend started as JavaScript/ESM with explicit route, middleware, controller, service, repository, model, authentication, and Socket.IO boundaries. The frontend started as React/JSX with Context-based authentication/realtime state and Zustand for client conversation state.

## Migration decision

Use TypeScript as an incremental boundary rather than converting every file at once.

The migration established:

- strict compiler configuration
- NodeNext ESM semantics compatible with the existing backend
- explicit `dist` output for the backend
- typed runtime configuration
- typed API error and request-validation contracts
- typed authentication/session boundaries
- typed user and chat persistence/service/controller boundaries
- typed Socket.IO event payloads
- typed frontend API, authentication, realtime, component, hook, and client-state boundaries

The migration was performed in reviewable slices, preserving the existing application architecture instead of introducing a new framework or ORM merely for TypeScript.

## Why this approach

A whole-repository extension-only conversion would create a large, difficult-to-review diff while preserving weak runtime boundaries. The existing service/repository structure is useful, so the migration strengthens those boundaries instead of replacing them.

The migration order was:

1. compiler/build/runtime foundation
2. error, request, and validation contracts
3. authentication/session contracts
4. user domain/repository/service/controller
5. message/conversation domain/repository/service/controller
6. Socket.IO event contracts and server boundary
7. frontend API/auth/realtime boundaries
8. frontend state and UI modules
9. removal of duplicate JavaScript source modules
10. strict TypeScript-only source configuration

## Dependency strategy

Backend development dependencies declare TypeScript, `tsx`, Node/Express/HTTP type packages, and JSON Web Token type definitions. Frontend development dependencies declare TypeScript and Node type packages. The current agent environment cannot reach the npm registry, so the backend and frontend lockfiles have deliberately not been fabricated or hand-edited. The branch therefore requires dependency installation before it can be fully verified with the new TypeScript scripts.

No runtime framework or ORM was introduced for TypeScript itself.

## Current migrated boundary

### Runtime/build

- `Backend/tsconfig.json`
- `Backend/index.ts`
- `Backend/config/env.ts`
- `Backend/utils/logger.ts`
- `Frontend/tsconfig.json`
- `Frontend/vite.config.ts`
- `Frontend/src/vite-env.d.ts`
- `Frontend/src/main.tsx`

Both application source trees now use strict TypeScript configuration. `allowJs` is disabled in both TypeScript configurations so JavaScript cannot silently re-enter the compiled application source boundary.

The frontend build script runs `tsc --noEmit` before `vite build`.

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

Request IDs, authenticated users, async handlers, validation results, and API error responses have explicit TypeScript boundaries.

### Authentication and users

- `models/session.model.ts`
- `auth/session.ts`
- `models/user.model.ts`
- `repositories/user.repository.ts`
- `services/user.service.ts`
- `controller/user.controller.ts`
- `routes/user.route.ts`
- `validation/user.schemas.ts`
- `Frontend/src/types/api.ts`
- `Frontend/src/context/AuthProvider.tsx`
- `Frontend/src/components/Login.tsx`
- `Frontend/src/components/Signup.tsx`

JWT payloads, session records, public users, registration inputs, protected request handling, and frontend authentication state have explicit TypeScript boundaries. The stable refresh-session behavior from Phase 02 is preserved.

### Chat domain

- `models/message.model.ts`
- `models/conversation.model.ts`
- `repositories/message.repository.ts`
- `repositories/conversation.repository.ts`
- `services/message.service.ts`
- `controller/message.controller.ts`
- `routes/message.route.ts`
- `validation/message.schemas.ts`
- `Frontend/src/types/api.ts`
- `Frontend/src/statemanage/useConversation.ts`
- `Frontend/src/context/useGetMessage.ts`
- `Frontend/src/context/useSendMessage.ts`
- `Frontend/src/context/useGetAllUsers.ts`

Message/conversation persistence and service inputs use explicit `Types.ObjectId` boundaries instead of passing route strings through the domain layer. Frontend message/user state and API results have explicit contracts. Message sending uses a functional Zustand update so a concurrent realtime update cannot be overwritten by a stale captured array.

### Realtime

- `SocketIO/events.ts`
- `SocketIO/server.ts`
- `Frontend/src/types/socket.ts`
- `Frontend/src/context/SocketContext.tsx`
- `Frontend/src/context/useGetSocketMessage.ts`

Socket.IO server-to-client event names and payloads are typed on both sides. Message events are serialized into a transport payload rather than emitting a raw Mongoose document. The client uses a typed Socket.IO instance and cleans up named listeners during teardown.

This does **not** solve socket authentication or distributed presence. The current socket identity remains client-supplied and the in-memory user-to-socket map remains single-instance/single-socket behavior; those are Phase 09/10 concerns.

## Frontend source boundary

The migrated frontend application source no longer keeps duplicate `.jsx` implementations alongside `.tsx` modules. The legacy `App.jsx`, authentication components/providers, chat components, hooks, Zustand store, Axios client, and left-panel components were removed after their TypeScript counterparts became the active imports.

Presentational build configuration files that remain JavaScript (for example Tailwind/PostCSS configuration) are tooling configuration, not application source modules. They are outside the TypeScript application compilation boundary.

## API/transport principle

Persistence documents are not treated as frontend contracts. Where the realtime boundary is migrated, MongoDB `ObjectId` and `Date` values are converted to string representations before emission.

The next shared-contract step should consolidate these DTOs so frontend and backend do not independently redefine the same wire shapes, if that proves useful after the database/API design phases.

## Frontend migration policy

`Frontend/tsconfig.json` uses `strict: true`, `moduleResolution: Bundler`, `isolatedModules`, and `noEmit`. `allowJs` is disabled because application source migration is complete.

Frontend ESLint still targets JavaScript/JSX only. TypeScript-aware ESLint should be introduced with the appropriate parser/plugin dependencies rather than pretending the existing ESLint parser can validate TypeScript. This is a dependency/tooling follow-up, not a reason to weaken TypeScript strictness.

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
