# Performance and Load Testing

This directory contains reproducible local performance tests for the chat application.

## Tool

Phase 18 uses Grafana k6 because the repository needs both HTTP and WebSocket workload generation with built-in latency, throughput, checks, thresholds, and summary output. Simpler alternatives considered were autocannon and a custom Node.js benchmark; neither provides as clean a single test model for the authenticated HTTP + Socket.IO workload required here. k6 is an external load generator, so it does not add runtime infrastructure to the application.

k6 is intentionally not added to the Node.js dependency graph. Install k6 on the developer/benchmark machine.

## Environment

Tests target a local Docker Compose runtime only. Never point these scripts at production or a database containing real user data.

Expected local API URL: http://localhost:4002.

The benchmark dataset is synthetic. Credentials are supplied through environment variables or deterministic values; no secrets are stored in source control.

## Scenarios

- auth.js: authenticated login and /api/user/me.
- message-retrieval.js: cursor-paginated message reads across a seeded conversation.
- message-send.js: synchronous message + outbox transaction path.
- realtime.js: authenticated Socket.IO connection lifecycle.
- mixed-chat.js: mixed authenticated reads, sends, and identity checks.

## Dataset

The seed command creates synthetic users, a direct conversation, and configurable message history in the local PostgreSQL database. It uses the repository runtime to generate the bcrypt hash so password hashing is not faked.

Run from the repository root:

```bash
docker compose up -d
docker compose run --rm backend npm run db:migrate
node load-tests/scripts/seed.mjs
```

The seed command prints the benchmark user IDs, receiver ID, and conversation ID. It does not print the benchmark password. Keep the identifiers local.

## Running

Install k6 separately, then run:

```bash
k6 run load-tests/scenarios/auth.js
k6 run load-tests/scenarios/message-retrieval.js
k6 run load-tests/scenarios/message-send.js
k6 run load-tests/scenarios/realtime.js
k6 run load-tests/scenarios/mixed-chat.js
```

Set the seeded receiver explicitly:

```bash
K6_RECEIVER_ID=<synthetic-receiver-uuid> k6 run load-tests/scenarios/message-retrieval.js
```

Profiles are controlled with K6_PROFILE=smoke|ci.

## Thresholds

Thresholds are benchmark acceptance thresholds, not production SLOs. They catch severe regressions in repeatable local runs. They do not establish production capacity.

## Results

Generated summaries belong under load-tests/results/ locally. Results are ignored by Git and must not contain credentials or production data.

## Methodology

For before/after comparison keep the same dataset, environment, k6 version, VU/rate stages, warm-up, duration, and measurement method. Record p50/p95/p99, throughput, error rate, concurrency, and relevant dependency observations. Correlate with the application's existing /metrics output and logs.

## Limitations

These are local benchmarks. They do not establish production capacity, cloud limits, Internet-facing network performance, or multi-region behavior.


## Authentication-rate-limit note

The application intentionally limits login attempts to 5 per synthetic email per 15-minute window. The authenticated workload scenarios therefore perform exactly one login during k6 `setup()` and reuse that synthetic session; they do not call `/login` on every iteration.

Run one benchmark scenario at a time with the seeded synthetic account. If the credential limiter has already been consumed, wait for its window to expire or seed/use another `phase18-benchmark-*@example.com` account. Do not disable or bypass the application rate limiter for performance testing.

The `auth.js` workload intentionally uses at most 5 concurrent one-shot login attempts in the `ci` profile so it remains inside the configured security limit.

## Reproducible run example

```bash
docker compose up -d
docker compose run --rm backend npm run db:migrate
node load-tests/scripts/seed.mjs

# Copy seedReceiverId from the seed output.
K6_RECEIVER_ID=<seedReceiverId> K6_PROFILE=smoke k6 run --summary-export=load-tests/results/message-retrieval.json load-tests/scenarios/message-retrieval.js
```

For query-plan diagnostics, replace the placeholders in `load-tests/scripts/explain-message-query.sql` with the `seedUserId`, `seedReceiverId`, and `conversationId` printed by the seed command, then run it against the local PostgreSQL container.

For comparison runs, keep the same `K6_RECEIVER_ID`, dataset size, Docker configuration, k6 version, profile, and machine.
