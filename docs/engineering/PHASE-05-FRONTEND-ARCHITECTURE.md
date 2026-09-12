# Phase 05 — Frontend Architecture + State Management

## Scope

Refactor the frontend into explicit UI, feature-hook, client-state, authentication, API, and realtime boundaries without changing the visual design or introducing infrastructure that belongs to later phases.

## Decisions

### Client state

Zustand is limited to application state that is shared by multiple components:

- selected conversation
- messages grouped by conversation
- loaded users used by multiple views

Transient UI state such as the search input remains local to its component.

### Server state

The current server-state surface is small enough that a second client-state paradigm is not justified yet. `useUsers` and `useMessages` own their request lifecycle while Zustand stores the shared results needed by the current UI.

TanStack Query is intentionally deferred. Message pagination, cache invalidation, mutations, and stale-data requirements will be reassessed when the production API and pagination work in Phase 08 lands.

### Realtime

Socket connection lifecycle remains isolated in `SocketContext`. Feature-level message ingestion lives in `useSocketMessages`. Socket events are cleaned up when the effect is disposed.

The frontend now exposes connection status and shows connecting/reconnecting state to the user. The current socket still receives the legacy client-supplied user ID; replacing that identity mechanism with server-derived authentication is explicitly a Phase 09 concern.

### Message consistency

REST message loads merge with existing realtime messages and deduplicate by message ID. This prevents a realtime message received while a REST request is in flight from being lost.

Outgoing messages are appended from the server response and deduplicated if the same message is subsequently delivered through Socket.IO.

True optimistic message lifecycle (`pending → sent → delivered → read/failed`) is intentionally deferred to the authenticated realtime/idempotency work in Phase 09. The current API does not expose a client-generated message identity or idempotency contract, so pretending an optimistic message is authoritative would create an avoidable consistency problem.

## Quality checklist

- [x] UI state is local where it does not need to be shared.
- [x] Shared conversation state has a domain-oriented store.
- [x] Duplicate message hook was removed.
- [x] Generic feature hooks live under `hooks/`, not `context/`.
- [x] REST and Socket.IO message races are handled.
- [x] Duplicate REST/socket messages are prevented by message ID.
- [x] Request effects cancel stale work on cleanup.
- [x] User/message loading, empty, retry, and error states are represented.
- [x] Socket listeners are registered and removed symmetrically.
- [x] Realtime connection status is exposed and visible.
- [x] Auth state gates socket creation and application routes.
- [x] TanStack Query was evaluated and deliberately not added yet.
- [x] No Redis, Kafka, PostgreSQL, or other later-phase infrastructure was introduced.

## Verification

The GitHub repository connector used for this phase does not provide a legitimate local shell/test runtime. Therefore no local lint, typecheck, test, or production build result is claimed from this phase.

The repository's `Frontend/package.json` already defines `typecheck`, `lint`, and `build` scripts. These must be executed in a real checkout before merging the branch.

## Remaining known work belongs to later phases

- Server-authoritative socket authentication and multi-device correctness — Phase 09.
- Production message lifecycle and idempotency — Phase 09.
- Redis-backed distributed presence/socket scaling — Phase 10.
- Frontend automated unit/integration/realtime/E2E testing infrastructure — Phase 12.
- Production pagination and richer server-state caching/invalidation — Phase 08.
