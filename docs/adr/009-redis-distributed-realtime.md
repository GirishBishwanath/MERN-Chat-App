# ADR 009: Redis for distributed Socket.IO and ephemeral presence

## Status

Accepted

## Context

Phase 09 established authenticated Socket.IO connections and correct multi-tab/multi-device presence inside one Node.js process. Socket membership and online-user tracking were held in process memory. That is sufficient for a single backend instance, but a user connected to multiple backend instances would be visible only to the instances that own its sockets, and a broadcast from one instance would not reach sockets owned by another instance.

The repository does not currently contain a rate limiter or a demonstrated hot-read path that requires a cache. Those responsibilities remain outside Phase 10.

## Decision

Use Redis for two narrowly scoped realtime responsibilities:

1. `@socket.io/redis-adapter` uses Redis Pub/Sub so Socket.IO broadcasts and room-targeted emissions can cross backend instances.
2. Redis stores ephemeral user presence under `chatapp:presence:user:<userId>` with a 60-second TTL.

The existing in-process `Map<string, Set<string>>` remains only as the local process's socket membership index. It is not treated as authoritative business data. Redis presence is the distributed ephemeral representation of online state.

PostgreSQL remains the persistent relational datastore and MongoDB remains present in the current live application boundary established before Phase 10. Redis does not store users, conversations, or messages.

## Alternatives considered

### Process-local memory only

Simplest and correct for one process, but it cannot provide cross-instance Socket.IO fan-out or a shared presence view.

### PostgreSQL presence

Would make transient connection state durable and would create unnecessary write load and cleanup complexity. Presence is explicitly ephemeral.

### Custom Redis Pub/Sub implementation

Would duplicate behavior already maintained by the Socket.IO Redis adapter and increase protocol/error-handling surface.

### Add Redis rate limiting or application caching now

Rejected because the current repository does not demonstrate a concrete implementation or workload that requires either use case.

## Consistency model

Presence is eventually consistent and ephemeral. A user is considered online while at least one local socket exists and its Redis presence key remains valid. TTL expiry makes stale presence converge to offline after process failure or missed cleanup. The application does not use presence as an authorization or persistence decision.

Socket.IO broadcasts remain transport-level delivery. Persistent messages continue to be written through the existing REST/database path before realtime delivery.

## TTL and memory behavior

Presence keys use a 60-second TTL and are refreshed when a connection is established. Explicit final-socket disconnect deletes the key. Key cardinality is bounded by users with active sockets plus a short window of stale keys after failures; Redis expiration handles cleanup automatically.

The Phase 10 implementation does not use Redis caching, unbounded lists, or persistent message storage.

## Failure behavior

Redis is currently a startup dependency for the realtime infrastructure. If Redis cannot be connected or verified during startup, server startup fails instead of silently running a partially distributed realtime implementation.

After startup, Redis connection errors are logged with error type only. Presence writes/deletes are asynchronous and failures are not allowed to crash the process. A temporary Redis failure can therefore make distributed presence stale or unavailable, while durable application data is unaffected.

The Socket.IO Redis adapter does not provide connection-state recovery. A socket reconnects through the normal authenticated Socket.IO lifecycle.

Redis must be private infrastructure with authentication/ACLs and TLS where appropriate; the adapter is not intended for an untrusted Redis network.

## Testing

Redis-specific integration tests use a real Redis server and cover connection-backed presence operations, TTL assignment, TTL refresh, explicit deletion, candidate filtering, and expiry behavior. Existing single-instance Socket.IO tests remain required. Cross-instance Socket.IO behavior must be verified with multiple server processes/instances before claiming that behavior as tested in this repository.

## Operational notes

The application uses the official `redis` Node.js client and a dedicated duplicated subscriber connection for the Socket.IO adapter. Clients are created once and closed during graceful application shutdown.
