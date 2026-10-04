# Phase 18 — Performance Engineering

## Status

**Implementation complete; final clean benchmark verification is still required before Phase 18 is closed.**

The phase uses a reproducible local k6 harness, synthetic PostgreSQL data, PostgreSQL query-plan analysis, application metrics, and evidence-backed outbox optimizations. No production endpoint, credential, database, Kafka broker, or Redis instance is used by the load suite.

## Tool decision

k6 is selected because this phase needs one load generator for both HTTP and WebSocket workloads, plus built-in latency percentiles, throughput, checks, thresholds, and summary output. A custom Node benchmark or Node-only HTTP tool would require separate machinery for the authenticated Socket.IO workload. k6 remains an external developer/benchmark tool and is not a runtime application dependency.

## Workloads

- Authentication: one login per VU/setup flow followed by authenticated API use.
- Message retrieval: first cursor page followed by a second cursor page.
- Message sending: authenticated synchronous message transaction including PostgreSQL + Transactional Outbox.
- Realtime: authenticated Engine.IO/WebSocket connection lifecycle.
- Mixed chat: controlled combination of identity reads, message reads, and message sends.

The workloads exercise real authentication cookies and the application's normal session boundary.

## Synthetic dataset

`load-tests/scripts/seed.mjs` creates two synthetic users, a direct conversation, membership rows, and configurable message history. Re-seeding cleans prior benchmark fixtures in dependency-safe transactional order.

Default dataset size is 500 messages; the script supports up to 10,000 synthetic messages. Benchmark credentials are confined to the `phase18-benchmark-*@example.com` namespace and are not printed by the seed command.

## Benchmark profiles

- `smoke`: 1 VU, 10 seconds.
- `ci`: 5 VUs, 30 seconds.

Thresholds are benchmark regression gates only. They are not production SLOs and do not establish production capacity.

## Measured benchmark results

All measurements below are local Docker Compose runs using the same seeded benchmark environment. They are evidence from executed workloads, not theoretical capacity claims.

### Message retrieval

CI run:
- 5 VUs for 30 seconds.
- 3,145 HTTP requests.
- 100.49 requests/second.
- 0% HTTP failures.
- Overall p95: 100.23 ms.
- First-page p95: 100.87 ms.
- Cursor-page p95: 97.16 ms.

Two smoke runs also passed with 0% failures. The first smoke run showed materially higher transient latency than the second, so no cold-start tuning was justified from a single sample.

### Message send

Pre-optimization controlled CI run:
- 5 VUs for 30 seconds.
- 1,288 HTTP requests.
- 39.87 requests/second.
- 0% failures.
- p95: 220.08 ms.
- Outbox backlog immediately after the run: 1,271 pending events.
- Oldest pending event age: about 39 seconds.

Post-index CI run:
- 5 VUs for 30 seconds.
- 1,223 HTTP requests.
- 38.71 requests/second.
- 0% failures.
- Endpoint p95: 261.08 ms.
- Overall p95: 261.97 ms.
- All 2,445 checks passed.

The post-index send benchmark passed its threshold, but the outbox metrics still showed a substantial backlog. Therefore the partial index improved the database claim-query cost but did not, by itself, make the relay sustainable at the observed input rate.

### Mixed chat

CI run:
- 5 VUs for 30 seconds.
- 3,300 HTTP requests.
- 105.53 requests/second.
- 0% failures.
- p95: 109.61 ms.

This is an observed local workload throughput, not a system capacity claim.

### Realtime

CI run:
- 50 WebSocket sessions.
- 0% failures.
- WebSocket connect p95: 153.45 ms.
- Maximum WebSocket connect time: 219.14 ms.
- All 101 realtime checks passed.

Smoke also completed successfully with 0% failures.

## PostgreSQL query analysis

The message retrieval plan used `messages_conversation_created_at_idx` with an index scan, no sequential scan, and no explicit sort. A representative execution completed in about 3.98 ms.

Direct conversation lookup used the unique pair index and completed in about 0.79 ms.

Receiver lookup used the users primary-key index and completed in about 0.19 ms.

No message-query database optimization was justified from these plans.

## Evidence-backed bottleneck

The initial message-send benchmark exposed an outbox relay bottleneck.

Under a controlled 5-VU / 30-second send workload, the application created roughly 1,288 messages while only a fraction of the corresponding outbox work was published during the run. The outbox snapshot showed more than 1,200 pending events with an increasing oldest-event age.

The original claim query used a nested-loop anti-join to enforce per-aggregate ordering. Under a large pending backlog it measured approximately:

- execution time: 4,385 ms
- shared buffer hits: about 2.99 million

A partial index on pending/processing aggregate order reduced the same backlog query to approximately:

- execution time: 47 ms
- shared buffer hits: about 7,133

The production migration is `Backend/db/migrations/004_outbox_pending_aggregate_order.sql`.

```sql
CREATE INDEX outbox_aggregate_pending_order_idx
    ON outbox_events (aggregate_id, sequence_number)
    WHERE status IN ('pending', 'processing');
```

The change preserves the existing `FOR UPDATE SKIP LOCKED` claim semantics and per-conversation ordering.

## Relay follow-up

After the index, the remaining throughput limitation was identified in the relay implementation itself. The relay originally performed one Kafka `producer.send()` and one PostgreSQL status update per event, sequentially, with a 20-event batch and a 1-second polling interval.

The relay was optimized in two layers:
- publish one Kafka batch per topic for the claimed events;
- update successful outbox rows with one PostgreSQL set-based statement;
- claim a contiguous, currently eligible prefix for one aggregate in a short transaction;
- use the earliest eligible aggregate row as the coordination frontier with `FOR UPDATE SKIP LOCKED`;
- retain per-aggregate ordering, bounded batch size, leases, and at-least-once delivery;
- retry the whole claimed batch when Kafka publication fails.

The important second change addresses the measured hot-conversation bottleneck: batching at the Kafka layer alone was ineffective when the database claim layer returned only one unfinished event per aggregate. The new claim path can hand the relay a real ordered batch from one busy conversation while concurrent relay instances remain prevented from claiming later events from that same aggregate.

## Reliability boundaries

The phase intentionally does not claim:
- production capacity;
- cloud capacity;
- exactly-once end-to-end delivery;
- Internet-facing latency;
- multi-region performance.

The Transactional Outbox remains authoritative for asynchronous event intent. Kafka publication remains at-least-once and consumer idempotency remains required.

## Reproducibility

Run the local stack:

```bash
docker compose up -d
docker compose run --rm backend npm run db:migrate
node load-tests/scripts/seed.mjs
```

Set the synthetic receiver UUID and run one scenario at a time:

```bash
K6_PROFILE=ci K6_RECEIVER_ID=<synthetic-receiver-uuid> \
k6 run --summary-export=load-tests/results/message-send-ci.json \
load-tests/scenarios/message-send.js
```

Store result artifacts locally under `load-tests/results/`; generated summaries are ignored by Git.

Keep the same machine, Docker configuration, dataset size, k6 version, profile, warm-up behavior, and duration for before/after comparisons.

## Phase 18 completion criteria

Phase 18 is complete when:
1. reproducible HTTP and WebSocket load scenarios exist;
2. synthetic data is reproducibly generated;
3. representative smoke and CI workloads have actually run;
4. latency, throughput, error rate, dependency behavior, and query plans have been measured;
5. at least one real bottleneck has been identified from evidence;
6. the optimization is encoded as a migration/code change and preserves correctness;
7. documentation records actual measurements and explicit interpretation limits.

The implementation and automated regression criteria are satisfied on the current phase branch. The final sustainability criterion remains intentionally evidence-based: the clean benchmark must show that the outbox backlog drains after traffic stops.

## Remaining verification

Pull the latest branch before the final verification because the latest relay batching change is now on GitHub:

```bash
git clean -f Backend/db/migrations/004_outbox_pending_aggregate_order.sql
git pull origin feat/performance-load-testing
```

Then run the existing backend regression checks and one final message-send CI workload against a clean seeded environment. Immediately after the load run, record the outbox counters and then wait for the relay to drain the backlog.

Phase 18 closes only when:
- HTTP failures remain below the benchmark threshold;
- message-send p95 remains below 1 second;
- outbox retries and dead letters remain zero;
- the pending backlog returns to zero after traffic stops;
- oldest pending age returns to zero;
- the drain is repeatable.

If the backlog still grows, continue measuring the relay rather than moving to Phase 19.