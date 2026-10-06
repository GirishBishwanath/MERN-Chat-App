# Benchmark Results

Store local benchmark summaries here when comparing runs.

Do not commit:
- credentials or authentication cookies
- production data
- unredacted logs
- machine-identifying information unless intentionally required

Use this template for a local engineering note:

## Environment
- Date:
- OS:
- CPU/RAM:
- Docker:
- k6:
- Node:
- PostgreSQL:
- Redis:
- Kafka:
- Dataset:
- Profile:

## Workload
- Scenario:
- VUs/rate:
- Warm-up:
- Duration:

## Results
- p50:
- p95:
- p99:
- Throughput:
- Error rate:

## Dependencies
- PostgreSQL observations:
- Redis observations:
- Kafka/outbox observations:

## Interpretation
State only what the measurements support. Do not convert a local benchmark into a production capacity claim.
