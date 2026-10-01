# Phase 15 — Kafka Event-Driven Architecture

## Status
Implemented on the dedicated Phase 15 branch; verification is reported only from checks actually executed.

## Problem
The synchronous chat path persists messages in PostgreSQL and delivers them through Socket.IO. Secondary processing should not become part of that user-facing request path.

Phase 15 introduces one asynchronous boundary for message notifications. A successfully persisted message produces a message.created domain event, and a notification consumer creates a notification record without making notification processing part of message persistence or realtime delivery.

Kafka is therefore used for asynchronous domain processing, not for primary message persistence or realtime delivery.

## Architecture
HTTP request -> validation/auth -> message service -> PostgreSQL -> Socket.IO -> asynchronous event publication -> Kafka -> chat-notification-consumer -> PostgreSQL notifications

PostgreSQL remains authoritative persistent business state. Redis remains responsible for distributed/ephemeral concerns. Socket.IO remains the realtime client transport. Kafka is the asynchronous event transport.

## Why Kafka
Kafka provides a durable, partitioned event log with consumer groups, so future independent consumers can process the same domain fact without coupling those capabilities to the message request path.

Synchronous notification processing is simpler, but couples secondary work to the user-facing path. An in-process queue is simple, but work is lost on process failure and cannot be independently consumed or scaled. Redis Streams is viable, but the project's Redis responsibility is distributed/ephemeral realtime infrastructure; Kafka is the clearer durable event backbone for independent consumer groups.

Kafka adds a broker, topic/partition operations, consumer lifecycle, local Docker resources, CI infrastructure, and operational failure modes. That cost is accepted only for this asynchronous boundary.

## Selected event
message.created is the first domain event. It represents the fact that a message has been successfully persisted.

The first consumer group is chat-notification-consumer. It creates an in-app notification record for the recipient. The database uniqueness constraint on recipient, message, and notification type makes repeated delivery safe at this business boundary without introducing Phase 16's generic idempotency store.

## Event envelope
DomainEvent<TEventType, TData> contains eventId, eventType, aggregateId, occurredAt, version, correlationId, causationId, producer, and typed data.

The message.created payload contains messageId, conversationId, senderId, recipientId, and createdAt. It does not contain message content, passwords, tokens, cookies, refresh tokens, or other secrets.

## Topic and partitioning
Topic: chat.message.v1

Local Kafka uses three partitions. The producer key is conversationId. Messages for the same conversation therefore use the same partition and can preserve relative partition ordering. There is no global ordering guarantee.

Malformed events use chat.message.dlq.v1.

## Consumer group
chat-notification-consumer represents the notification capability. Future independent capabilities should use separate consumer groups.

## Failure behavior
PostgreSQL succeeds and Kafka is unavailable: the API still returns the successful message response and Socket.IO remains on the synchronous path. Kafka publication is attempted asynchronously and failures are logged.

Kafka becomes available after startup: startup Kafka initialization is best effort. The core API does not make Kafka a readiness dependency. A process restart with Kafka available initializes the producer and consumer.

Consumer processing failure: the handler throws so the current event is not treated as successfully processed. Full poison-message handling and durable retry state are deferred to Phase 16.

Malformed event: the consumer validates the envelope and payload. Invalid events are logged and sent to the DLQ when the producer is available.

Duplicate event: the notification insert uses ON CONFLICT DO NOTHING on the recipient/message/type uniqueness constraint.

## Schema evolution
The event carries an explicit version. Consumers reject incompatible versions instead of silently accepting a different payload. Additive compatible changes retain the version; breaking changes require a new version/topic contract.

A schema registry is intentionally not introduced in Phase 15. Versioned TypeScript contracts plus runtime validation are sufficient for the current single-producer/single-consumer scope.

## Security
Kafka is not a public application endpoint. Local development exposes only the required host port. Events exclude authentication credentials and sensitive transport data. Configuration is environment-driven and no broker credentials are committed.

## Docker
Local Compose now contains frontend, backend, PostgreSQL, Redis, and Apache Kafka 4.3.1 in single-node KRaft mode. Backend-to-Kafka traffic uses kafka:9092. Host-side development tooling uses port 29092.

The local broker has three partitions and one replica because it is a development broker, not a production cluster.

## CI
GitHub Actions backend validation provisions a disposable Apache Kafka 4.3.1 service alongside PostgreSQL and Redis. Kafka integration tests therefore exercise a real broker rather than a full mock.

No cloud Kafka dependency is introduced.

## Testing
Coverage includes event envelope creation and runtime validation, malformed metadata/payload tests, real Kafka producer/consumer integration, and duplicate event processing at the notification business boundary.

The authoritative backend integration lifecycle now includes the Kafka integration suite.

## Consistency guarantee
Phase 15 does not provide atomic database-to-Kafka publication.

The current sequence is PostgreSQL commit -> Socket.IO delivery -> Kafka publish attempt.

A process crash between PostgreSQL commit and Kafka publication can lose the event. A published event may also be observed more than once, so consumers must tolerate duplicates.

The core message remains correct because PostgreSQL is authoritative.

## Why Outbox is deferred
Phase 15 deliberately does not create an outbox_events table, outbox publisher, reconciliation process, or durable publication state.

Phase 16 will use a PostgreSQL transaction containing both the business record and an outbox event, followed by a publisher and Kafka consumers.

## Operational/interview explanation
The defensible explanation is: the chat request stays synchronous because message persistence and realtime delivery are user-facing correctness paths. Kafka was introduced only after identifying secondary message processing that should not increase request coupling. The first event is a versioned message.created fact, partitioned by conversation, and consumed by a notification capability. Phase 15 explicitly accepts the database/Kafka dual-write gap; Phase 16 adds the Transactional Outbox before the system claims reliable publication.

## Phase boundary
Not implemented: Transactional Outbox, durable generic consumer idempotency, production retry orchestration, production replay/reconciliation, managed Kafka, AWS/MSK, Kubernetes, or the full Phase 17 observability platform.