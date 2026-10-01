# Phase 16 — Transactional Outbox & Reliability

## Status

Implementation complete pending final repository verification.

## Problem

Phase 15 persisted a chat message in PostgreSQL and published `message.created` to Kafka separately. A process crash after the database commit but before Kafka publication could therefore lose the asynchronous event.

## Implemented design

The message write path now uses a PostgreSQL transaction for:

1. message insertion;
2. creation of the versioned `message.created` event envelope;
3. insertion of the exact serialized event into `outbox_events`.

The HTTP request no longer publishes directly to Kafka.

After commit, Socket.IO still emits the realtime message to the recipient. Kafka publication is handled independently by the durable outbox relay.

### Outbox schema

`outbox_events` stores:

- immutable event payload;
- event type and version;
- Kafka topic;
- conversation partition key;
- processing status;
- attempt count;
- availability time;
- processing lease;
- last error;
- publication timestamp.

The outbox row uses the conversation ID as its ordering aggregate while the event contract retains the message ID as its event aggregate ID.

### Relay behavior

The relay:

- polls PostgreSQL;
- claims work with `FOR UPDATE SKIP LOCKED`;
- uses a lease to recover rows abandoned by crashed workers;
- only claims the earliest unfinished event for a conversation;
- publishes the stored payload rather than reconstructing it;
- marks successful publication as `published`;
- retries failures using bounded exponential backoff;
- marks repeatedly failing events `dead_lettered` while retaining the payload and error metadata.

Multiple relay workers can safely share the table.

### Delivery semantics

The relay provides **at-least-once publication**.

If Kafka accepts an event and the relay crashes before marking the database row published, the event can be published again after lease expiry. The system therefore does not claim end-to-end exactly-once delivery.

### Consumer idempotency

The notification consumer now records `(consumer_name, event_id)` in `processed_events` inside the same PostgreSQL transaction as the notification side effect.

A duplicate event is acknowledged without repeating the side effect.

If the notification transaction fails, the processed-event marker is rolled back so Kafka can retry the event.

### Failure behavior

| Failure | Result |
| --- | --- |
| Business transaction rolls back | Message and outbox event are both absent |
| Business transaction commits | Message and outbox event both exist |
| Kafka unavailable | Outbox remains pending and retries |
| Relay crashes while processing | Lease expires and event becomes reclaimable |
| Kafka accepts then relay crashes | Duplicate publication is possible; consumer idempotency handles it |
| Maximum publish attempts exceeded | Outbox row becomes dead-lettered with payload/error retained |
| Consumer side effect fails | Processed marker rolls back and Kafka retries |
| Duplicate consumer delivery | Existing side effect remains single-instance |

## Testing

Phase 16 adds integration coverage for:

- atomic message + outbox persistence;
- rollback of the whole transaction;
- exact stored-payload publication;
- retry and exponential backoff;
- bounded attempts and dead-letter transition;
- lease expiry and crash recovery;
- per-conversation event ordering;
- duplicate notification delivery.

The existing Kafka integration suite remains responsible for broker-level publication/consumer behavior.

## Operational notes

Phase 16 intentionally does not add metrics, tracing, automated alerting, or outbox retention jobs. Those belong to the later observability/performance phases.

The dead-lettered state is durable PostgreSQL state rather than a claim of successful Kafka DLQ publication. This ensures an unavailable Kafka broker cannot cause the failure record itself to disappear.

## Verification

The authoritative verification commands are:

```bash
cd Backend
npm ci
npm run typecheck
npm test
npm run test:coverage
npm run build
```

Docker/CI verification also remains required because Kafka, PostgreSQL, and Redis are part of the integration environment.

## Scope boundary

Phase 16 does not introduce:

- Kafka Streams;
- Kafka Connect/CDC;
- Kubernetes;
- AWS infrastructure;
- Terraform;
- metrics/tracing systems;
- GenAI/RAG features;
- new user-facing chat features.

Those remain deferred to later roadmap phases.
