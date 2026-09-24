# ADR 013: Kafka Event-Driven Architecture

## Status
Accepted

## Context
The chat application already has a correct synchronous path in which PostgreSQL is authoritative for message persistence and Socket.IO delivers realtime updates. Secondary processing should not be coupled to that request path as the product grows.

A durable asynchronous boundary is useful for notification processing and later independent consumers such as moderation, analytics, search, or AI preparation.

## Decision
Introduce Apache Kafka as the asynchronous domain-event transport.

The first event is message.created. The first consumer group is chat-notification-consumer. The consumer creates a PostgreSQL notification record for the recipient.

Kafka does not replace PostgreSQL, Redis, or Socket.IO.

- PostgreSQL: authoritative persistent business state.
- Redis: distributed/ephemeral state and Socket.IO scaling.
- Socket.IO: realtime client transport.
- Kafka: asynchronous domain-event transport.

## Event contract
Events use a versioned envelope containing eventId, eventType, aggregateId, occurredAt, version, correlationId, causationId, producer, and typed data.

message.created contains only message/conversation/sender/recipient identifiers and the message creation timestamp.

No credentials, tokens, cookies, passwords, or unnecessary message contents are published.

## Topic and ordering
The event is published to chat.message.v1. The producer key is conversationId. This establishes ordering within a conversation's assigned partition where Kafka partition ordering applies. There is no global ordering guarantee.

Malformed events are sent to chat.message.dlq.v1.

The local development broker has three partitions and one replica.

## Alternatives considered
### Synchronous notification processing
Rejected for the first asynchronous capability because it makes secondary work part of the user-facing message request path.

### In-process queue
Rejected because process failure loses queued work and there is no durable consumer-group boundary.

### Redis Streams
Technically viable, but the repository's Redis responsibility is distributed/ephemeral realtime infrastructure. Kafka is the clearer durable event backbone for independent consumer groups and future event processing.

### Kafka plus microservices
Rejected. The application remains a single deployable backend. A separate microservice is not justified by the current consumer count.

### Schema registry
Deferred. One versioned TypeScript contract with runtime validation is sufficient for the current event surface.

## Producer boundary
The message service persists the message first. The controller constructs the domain event with the request correlation ID and invokes a focused event publisher. Raw Kafka calls are kept out of business services.

Publication is asynchronous from the HTTP response path.

## Consumer boundary
The Kafka transport callback validates the event and performs the notification persistence side effect. Malformed events are treated as contract failures and sent to the DLQ when possible. Downstream processing errors are allowed to fail the handler so the message is not acknowledged as successfully processed.

## Consequences
Positive:
- secondary notification processing is decoupled from message request latency;
- future consumers can subscribe independently;
- conversation-keyed partitions establish a clear ordering model;
- event contracts are explicit and runtime validated;
- the synchronous chat path remains PostgreSQL plus Socket.IO.

Costs:
- Kafka is an additional local and CI infrastructure dependency;
- the backend now has producer and consumer lifecycle management;
- operators must understand topics, partitions, consumer groups and failed processing;
- Phase 15 still has a database/Kafka dual-write gap.

## Reliability boundary
Phase 15 intentionally does not implement the Transactional Outbox Pattern.

The failure window is PostgreSQL commit -> process crash -> Kafka publication never occurs.

Therefore Phase 15 does not claim atomic or guaranteed database-to-event publication.

Phase 16 will introduce the Transactional Outbox and durable consumer idempotency.

## Testing
The repository includes contract tests and a real Kafka integration test. CI provisions a disposable Kafka broker.

The integration test verifies publication, consumption into PostgreSQL notification state, and duplicate delivery safety.

## Security
Kafka is local/private infrastructure in this phase. Configuration is environment-driven. Sensitive authentication/session data is excluded from events and logs.

## Operational complexity
Kafka is intentionally limited to one topic plus a DLQ topic, one consumer group, one local broker, and one focused consumer. No microservices, managed Kafka, Kubernetes, or schema registry are introduced.

## Interview justification
Kafka is present because a real asynchronous domain boundary exists: notification processing should not make message persistence and realtime delivery depend on secondary work.