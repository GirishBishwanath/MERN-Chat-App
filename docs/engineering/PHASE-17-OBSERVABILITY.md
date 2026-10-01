# Phase 17 — Production Observability & Incident Debugging

## Status

Implementation complete on `feat/observability-incident-debugging`. Final correctness is established by the repository's automated CI checks; local execution was unavailable in this environment because the runtime cannot resolve `github.com`.

## Architecture decision

Phase 17 keeps observability dependency-light:

- structured JSON logs with log-level filtering and recursive sensitive-field redaction
- bounded `X-Request-Id` propagation
- in-process Prometheus-compatible metrics
- truthful liveness/readiness checks
- targeted PostgreSQL, Redis, Kafka, Outbox, and Socket.IO telemetry
- a metrics endpoint at `GET /metrics`

No Prometheus, Grafana, OpenTelemetry, Jaeger, Loki, ELK, Sentry, Datadog, New Relic, CloudWatch, AWS, Kubernetes, Terraform, or new frontend/product features were introduced.

The existing `requestId`, event `correlationId`, `eventId`, and durable outbox identifiers remain the correlation primitives. Kafka lag is intentionally not exposed because the current implementation has no authoritative consumer-group lag collector.

## Metric semantics

HTTP metrics use bounded `method`, route template, and status dimensions. Kafka/Outbox metrics use controlled event type/topic dimensions. Redis and Socket.IO metrics use controlled operation/reason dimensions.

Metrics do not use user IDs, request IDs, message IDs, conversation IDs, raw URLs, message content, emails, or credentials as labels.

The current metrics are process-local. They must not be interpreted as globally aggregated totals across multiple backend instances.

Outbox gauges expose:

- pending events
- processing events
- oldest pending event age

Gauge collection is best-effort. A failed metrics scrape does not affect application correctness.

## Health semantics

`/health/live` answers whether the process can respond to HTTP requests.

`/health/ready` checks PostgreSQL and Redis because those dependencies are required for the normal API/realtime workload. Kafka is reported as `connected`, `unavailable`, or `disabled`, but Kafka failure does not make readiness fail: message persistence remains synchronous and the outbox provides durable asynchronous delivery.

Health responses expose only dependency states; they do not expose credentials, stack traces, SQL, or connection strings.

## Correlation path

For message creation the operational path is:

`X-Request-Id → requestId → message.created.correlationId → outboxEventId/eventId → Kafka topic/partition → notification consumer`

The event contract remains unchanged for observability. The message body is not logged as telemetry.

## Incident debugging workflow

Scenario: a user reports that a sent message did not result in a notification.

1. Capture the API response timestamp/status and `X-Request-Id`.
2. Search the `http_request` log for that request ID.
3. Carry the same correlation ID to the outbox publication/retry/dead-letter records.
4. Use `eventId` and `outboxEventId` with topic/partition to follow Kafka processing.
5. Inspect the consumer log for processed, duplicate, invalid, or failed states.
6. Inspect the durable outbox row and the outbox gauges.
7. Check PostgreSQL and Redis failure telemetry if the workflow crossed those boundaries.
8. Collect evidence before changing code and classify the failure as client error, transient dependency failure, persistent dependency failure, or application defect.

## Security controls

The logger redacts credential-like keys recursively and sanitizes common credential-bearing strings. Telemetry does not intentionally emit:

- passwords or password hashes
- JWTs, access tokens, or refresh tokens
- cookies or authorization headers
- database credentials or complete credential-bearing connection strings
- message bodies or private conversation content

Request IDs are limited to 128 safe characters before propagation. Metric labels are intentionally bounded.

## Failure behavior

Telemetry is best-effort:

- logger serialization has a safe fallback
- metrics are in-process and do not participate in business transactions
- outbox metric collection failures do not change outbox state
- Kafka remains optional at startup
- Kafka availability is not required for synchronous message persistence

## Scope boundary

Phase 17 does not include load testing, GenAI/RAG, AWS/Kubernetes/Terraform, frontend redesign, or new chat product features.
