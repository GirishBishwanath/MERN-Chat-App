# ADR 0016: Transactional Outbox and Durable Kafka Relay

## Status

Accepted — Phase 16.

## Context

Phase 15 introduced Kafka event publication for `message.created`, but the HTTP message path currently commits the PostgreSQL message and then publishes to Kafka separately. A process failure between those operations can leave a committed message without its corresponding event.

The application already uses PostgreSQL as the authoritative business datastore and Kafka as the asynchronous transport. Phase 16 needs durable event intent, at-least-once publication, crash recovery, bounded retries, and idempotent consumer behavior without introducing another infrastructure dependency.

## Decision

Use a PostgreSQL Transactional Outbox with a polling publisher.

For message creation:

1. Validate the request and resolve the direct conversation.
2. Generate the message UUID and versioned `message.created` event before the database transaction.
3. Begin one PostgreSQL transaction.
4. Insert the message.
5. Insert the exact event envelope, topic, partition key, and headers into `outbox_events`.
6. Commit.
7. Emit the existing Socket.IO realtime notification after the database commit.

The HTTP request does not publish to Kafka.

A durable relay process polls `outbox_events`:

- claims eligible rows with `FOR UPDATE SKIP LOCKED`;
- marks claimed rows as `processing` with a lease;
- only claims the earliest unfinished event for a given conversation/aggregate, preserving per-conversation ordering;
- publishes the stored event payload without reconstructing it;
- marks successful publications `published`;
- on transient failure, returns the row to `pending` with bounded exponential backoff;
- after the configured maximum attempts, marks the row `dead_lettered` while retaining the payload and failure metadata for operator replay/inspection;
- expired processing leases become eligible again after a publisher crash.

Kafka publication is intentionally at-least-once. If Kafka accepts an event and the process crashes before the database marks the outbox row as published, the event can be published again. Consumers therefore remain idempotent.

The notification consumer uses the existing database uniqueness invariant and will additionally persist a consumer-level processed-event identity so duplicate Kafka delivery cannot create duplicate side effects.

## Alternatives considered

### Direct Kafka publication from the HTTP request

Rejected. It has the PostgreSQL/Kafka dual-write failure window that Phase 16 exists to remove.

### Kafka transactions

Rejected for this phase. Kafka transactions do not make the PostgreSQL business transaction atomic with Kafka without a distributed transaction strategy, and they add complexity that does not solve the database commit boundary.

### PostgreSQL WAL/CDC

Rejected for this phase. CDC can provide strong delivery characteristics, but it introduces a separate operational component and is not justified for the current single-service repository. The polling publisher is easier to operate, test, and explain.

### Redis-backed outbox

Rejected. PostgreSQL is already the source of truth and provides the required transaction and row-locking semantics. Redis would add another failure boundary without improving correctness.

## Consequences

### Positive

- A committed message always creates durable event intent in the same database transaction.
- Kafka downtime does not lose events.
- Publisher crashes are recoverable through leases.
- Duplicate publication is explicitly tolerated and handled by idempotent consumers.
- Multiple relay workers can safely share work.
- Event payloads are immutable after the business transaction commits.

### Negative

- Events are eventually consistent rather than synchronously published.
- The outbox table requires retention/cleanup operations in a later operational phase.
- The relay adds background-process lifecycle and retry state.
- At-least-once publication means downstream consumers must remain idempotent.

## Consistency model

PostgreSQL is authoritative for the message and outbox record. Kafka publication is eventually consistent with the committed database state.

The guarantee is:

- transaction rollback => neither message nor outbox event exists;
- transaction commit => message and outbox event both exist;
- Kafka unavailable => outbox event remains durable and retryable;
- relay crash after Kafka acceptance => duplicate publication is possible;
- duplicate consumer delivery => consumer side effects remain idempotent.

No exactly-once end-to-end guarantee is claimed.

## Testing strategy

Phase 16 tests cover:

- message and outbox commit together;
- rollback leaves neither record;
- stored payload is published unchanged;
- concurrent relay workers do not claim the same row;
- expired leases are reclaimed;
- transient publish failures back off and retry;
- maximum attempts become dead-lettered;
- a publish-before-mark-published crash is safely recoverable;
- duplicate notification events produce one notification;
- malformed events remain on the existing Kafka DLQ path.

## Observability

The relay emits structured events for:

- claim;
- publish success;
- transient publish failure;
- dead-letter transition;
- lease recovery.

Logs include outbox event ID, event type, aggregate ID, attempt count, topic, and correlation ID where available.

Metrics are intentionally deferred to Phase 17 observability rather than adding a second metrics system here.

## Interview justification

The design demonstrates the practical Transactional Outbox pattern in a PostgreSQL + Kafka system, including the important tradeoff that reliable asynchronous publication normally means at-least-once delivery and therefore requires idempotent consumers.
