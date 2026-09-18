# ADR 009: Redis for distributed Socket.IO and ephemeral presence

## Status

Accepted

## Context

Phase 09 established authenticated Socket.IO connections and correct multi-tab/multi-device presence inside one Node.js process. Socket membership and online-user tracking were held in process memory. That is sufficient for a single backend instance, but a user connected to multiple backend instances would be visible only to the instances that own its sockets, and a broadcast from one instance would not reach sockets owned by another instance.

The repository does not currently contain a rate limiter or a demonstrated hot-read path that requires a cache. Those responsibilities remain outside Phase 10.

## Decision

Use Redis for two narrowly scoped realtime responsibilities:

1. `@socket.io/redis-adapter` uses Redis Pub/Sub so Socket.IO broadcasts and room-targeted emissions can cross backend instances.
2. Redis stores ephemeral presence as per-user socket leases plus a global online-user index.

Presence uses these keys:

- `chatapp:presence:user:<userId>:sockets` — sorted set of socket IDs scored by lease expiry time.
- `chatapp:presence:users` — sorted set of online user IDs scored by the latest active socket lease expiry.

Each socket lease is valid for 60 seconds and is refreshed by the Socket.IO heartbeat every 30 seconds. The per-user Redis key has a 120-second Redis key TTL as a cleanup backstop. Presence updates that change multiple Redis structures use Lua scripts so connect, heartbeat, disconnect, and expiry cleanup cannot observe or create an intermediate state.

The existing in-process `Map<string, Set<string>>` remains only as the local process's socket membership index for local lifecycle decisions. It is not treated as authoritative distributed presence. Redis is the distributed ephemeral representation of online state.

PostgreSQL remains the persistent relational datastore and MongoDB remains present in the current live application boundary established before Phase 10. Redis does not store users, conversations, or messages.

## Alternatives considered

### Process-local memory only

Simplest and correct for one process, but it cannot provide cross-instance Socket.IO fan-out or a shared presence view.

### Single Redis key per user

Simpler, but unsafe for multiple sockets across instances: one socket disconnecting could delete presence while another socket remains connected. It also makes global online-user enumeration awkward.

### PostgreSQL presence

Would make transient connection state durable and would create unnecessary write load and cleanup complexity. Presence is explicitly ephemeral.

### Custom Redis Pub/Sub implementation

Would duplicate behavior already maintained by the Socket.IO Redis adapter and increase protocol/error-handling surface.

### Add Redis rate limiting or application caching now

Rejected because the current repository does not demonstrate a concrete implementation or workload that requires either use case.

## Consistency model

Presence is eventually consistent and ephemeral. A user is online while at least one non-expired socket lease exists. A heartbeat extends the lease; a clean final disconnect removes it immediately; a crashed process leaves a lease that expires within the configured lease window.

The global online-user index is derived from the socket leases and updated atomically with the per-user lease changes. It is not used for authorization or persistent business decisions.

Socket.IO broadcasts remain transport-level delivery. Persistent messages continue to be written through the existing REST/database path before realtime delivery.

## TTL and memory behavior

Socket leases have a 60-second logical lease. The per-user sorted-set key has a 120-second Redis TTL and is refreshed by each heartbeat. The global online-user index contains one member per currently online user plus a bounded stale window until the next presence read prunes expired members.

Explicit final-socket disconnect removes the socket lease and either removes the user from the global index or recalculates the user's remaining lease.

Redis does not contain conversation history, users, or other persistent business records.

## Failure behavior

Redis is currently a startup dependency for the realtime infrastructure. If Redis cannot be connected or verified during startup, server startup fails instead of silently running a partially distributed realtime implementation.

After startup, Redis presence failures are logged with error type only and do not crash the process. A temporary Redis failure can make distributed presence stale or unavailable, while durable application data is unaffected.

The Socket.IO Redis adapter does not provide connection-state recovery. A socket reconnects through the normal authenticated Socket.IO lifecycle.

Redis must be private infrastructure with authentication/ACLs and TLS where appropriate; the adapter is not intended for an untrusted Redis network.

## Testing

Redis-specific integration tests use a real Redis server and cover:

- bounded socket leases
- lease refresh
- multiple sockets for one user
- global online-user enumeration
- expiry cleanup
- final-disconnect behavior
- cross-instance Socket.IO room delivery

The Socket.IO tests also verify authenticated socket identity, multiple sockets, reconnect behavior, and Redis lifecycle cleanup.

## Operational notes

The application uses the official `redis` Node.js client and a dedicated duplicated subscriber connection for the Socket.IO adapter. Clients are created once and closed during graceful application shutdown.

Redis test infrastructure uses a dedicated database configured by the test environment. The cross-instance adapter test uses a separate test database to avoid concurrent `FLUSHDB` interference between test files.
