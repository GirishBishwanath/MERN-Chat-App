# ADR 0017: Dependency-Light Production Observability

## Status

Accepted

## Context

Phase 16 introduced durable asynchronous processing and consumer idempotency. The application already had structured logs, request IDs, event correlation IDs, PostgreSQL, Redis, Kafka, Socket.IO, and a durable Outbox, but important operational signals were fragmented.

## Decision

Use a dependency-light observability layer inside the existing API process:

- structured JSON logs with debug/info/warn/error semantics
- bounded request ID propagation
- process-local Prometheus-compatible metrics
- explicit liveness/readiness semantics
- targeted instrumentation at HTTP, authentication, PostgreSQL, Redis, Kafka/Outbox, and Socket.IO boundaries
- a scrape endpoint at `GET /metrics`

Do not add a separate observability platform in Phase 17.

## Alternatives considered

A full OpenTelemetry + collector stack, Prometheus/Grafana, or hosted error tracking would provide richer aggregation and visualization, but the current architecture does not require a new telemetry control plane to answer its primary incident questions. Those systems also add exporter configuration, credentials, local infrastructure, sampling decisions, deployment cost, and vendor/runtime coupling.

## Consequences

Positive:

- important failure transitions are searchable from structured logs
- request-to-event correlation is preserved
- operational counters/histograms are available without another runtime dependency
- readiness reflects actual hard dependencies without coupling it to Kafka availability
- outbox health can be observed without affecting business correctness

Tradeoffs:

- metrics are process-local and are not globally aggregated
- no authoritative Kafka consumer lag is exposed
- metrics are scrape-based and require an external collector later for long-term aggregation/alerting
- logger redaction reduces accidental secret exposure but is not a substitute for never passing secrets to the logger

## Security

Telemetry intentionally avoids credentials, authentication tokens, cookies, authorization headers, database credentials, message contents, and high-cardinality user identifiers.

## Future evolution

When deployment topology or incident volume requires distributed traces, long-term metrics retention, centralized dashboards, or external error aggregation, evaluate OpenTelemetry and a managed/hosted observability service as a separate architecture decision.
