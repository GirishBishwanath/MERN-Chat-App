# Phase 18 — Performance Engineering

## Status

The benchmark harness and reproducible synthetic dataset tooling are implemented on `feat/performance-load-testing`. Baseline execution remains pending on a machine with Docker Compose and k6.

The repository currently contains a local k6 harness and synthetic PostgreSQL seed tooling. No production endpoint, credential, database, Kafka broker, or Redis instance is used by the test suite by design.

## Tool decision

k6 is selected because this phase needs one load generator for both HTTP and WebSocket workloads, plus built-in latency percentiles, throughput, failure rates, checks, and thresholds. A custom Node benchmark or a Node-only HTTP tool would add separate machinery for the Socket.IO workload. k6 is intentionally not a runtime application dependency.

## Current workloads

- Authentication: login followed by authenticated `/api/user/me`.
- Message retrieval: first cursor page followed by a second cursor page.
- Message sending: authenticated synchronous message + PostgreSQL transaction + outbox path.
- Realtime: authenticated Engine.IO/WebSocket transport handshake and connection lifecycle.
- Mixed chat: identity reads, message reads, and message sends in a controlled mix.

The workload scripts use real authentication cookies instead of bypassing the session boundary.

## Synthetic dataset

`load-tests/scripts/seed.mjs` creates two synthetic users, a direct conversation, membership rows, and configurable message history. Re-running the seed removes prior benchmark conversation outbox events before recreating the synthetic dataset. Password hashes are generated with the repository bcrypt implementation inside the local Docker backend container.

Default dataset size is 500 messages and can be changed with `K6_MESSAGE_COUNT` up to 10,000.

## Threshold policy

Thresholds in the scripts are benchmark acceptance thresholds only. They are not production SLOs or capacity guarantees.

## Baseline measurement status

No authoritative baseline has been recorded in this document yet because a real local Docker + k6 execution is required. A benchmark number must only be added after the workload is actually run and its environment is recorded.

## Required local execution

From the repository root:

```bash
docker compose up -d
docker compose run --rm backend npm run db:migrate
node load-tests/scripts/seed.mjs
```

Then obtain the printed synthetic receiver UUID and run, for example:

```bash
K6_RECEIVER_ID=<synthetic-receiver-uuid> k6 run load-tests/scenarios/message-retrieval.js
K6_RECEIVER_ID=<synthetic-receiver-uuid> k6 run load-tests/scenarios/message-send.js
K6_RECEIVER_ID=<synthetic-receiver-uuid> k6 run load-tests/scenarios/mixed-chat.js
k6 run load-tests/scenarios/auth.js
```

Realtime performs its own one-time login during k6 `setup()` and reuses the resulting cookie for the scenario. No manual `K6_COOKIE` value is required.

## Measurements to record

For every comparable run record:

- scenario
- k6 version
- Node version
- Docker version
- OS/CPU/RAM
- PostgreSQL/Redis/Kafka versions
- dataset size
- VUs or request rate
- warm-up
- duration
- p50
- p95
- p99
- throughput
- error rate
- relevant application metrics
- database behavior
- Redis behavior
- Kafka/outbox behavior where measured

## Interpretation boundary

These are local benchmark measurements. They do not establish production capacity, cloud capacity, or Internet-facing performance.

## Next engineering step

Run the identical baseline workloads against the seeded local stack, correlate the results with `/metrics` and application logs, inspect PostgreSQL query plans, and optimize only evidence-backed bottlenecks.