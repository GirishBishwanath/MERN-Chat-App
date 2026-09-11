# MERN-Chat-App — Engineering Roadmap

**Repository:** `GirishBishwanath/MERN-Chat-App`  
**Execution model:** sequential, evidence-driven, repository-first

This roadmap is the version-controlled execution plan for evolving the chat application into a production-quality full-stack system. Each phase starts by inspecting the current committed repository because previous work may change implementation assumptions.

## Phases

| Phase | Name | Primary outcome | Status |
|---|---|---|---|
| 1 | Forensic Repository Audit | Verified architecture, severity-ranked findings, migration risks, and execution order | **Complete** |
| 2 | Production Auth & Session Reliability | Server-authoritative authentication, secure cookie/session lifecycle, `/auth/me`, logout and expiry handling | **Implemented; verification completed locally** |
| 3 | Backend Architecture / Error / Validation Foundation | Clear backend boundaries, validation, centralized errors, config validation, health/readiness/liveness | **Implemented; verification pending local execution** |
| 4 | TypeScript Migration | Strict TypeScript, domain types, DTOs, API/socket/event contracts | Pending |
| 5 | Frontend Architecture / State Management | Deliberate UI, feature, server-state, client-state, API and realtime boundaries | Pending |
| 6 | PostgreSQL Data Model Design | Relational schema, constraints, indexes, access patterns, cursor-pagination design | Pending |
| 7 | Safe MongoDB → PostgreSQL Migration | PostgreSQL implementation, migrations, transactions, integrity checks, rollback strategy | Pending |
| 8 | Production API / Message Pagination | Stable API contracts, authorization, bounded cursor pagination, consistent errors/statuses | Pending |
| 9 | Authenticated Realtime / Socket Correctness | Server-authenticated Socket.IO, reconnect/multi-device correctness, deduplication | Pending |
| 10 | Redis Distributed Use Cases | Justified Redis usage for presence, rate limiting, Socket.IO scaling, or demonstrated caching | Pending |
| 11 | Security Hardening | Public-exposure security review and regression tests | Pending |
| 12 | Testing System | Unit, integration, realtime, E2E, contract, and load-testing foundations | Pending |
| 13 | Docker / Local Development | Production-quality images and reproducible local infrastructure | Pending |
| 14 | GitHub Actions CI/CD | Automated validation, image builds, staging/smoke verification, rollback strategy | Pending |
| 15 | Kafka / Event-Driven Architecture | Meaningful domain events, typed envelopes, retries, ordering, observability | Pending |
| 16 | Outbox / Idempotent Consumers / Reliability | Transactional outbox, duplicate safety, retries, DLQ, failure-mode tests | Pending |
| 17 | Observability / Incident Debugging | Structured telemetry and actionable production diagnosis | Pending |
| 18 | Performance / Load Testing | Real measurements, bottleneck identification, reproducible before/after results | Pending |
| 19 | GenAI / RAG Product Capability | Product-integrated AI with access control, cost/failure/privacy controls and evaluation | Pending |
| 20 | AWS / Kubernetes / Terraform / Final Review | Reproducible cloud architecture and skeptical hiring-manager review | Pending |

## Execution rules

1. Run the phases one at a time and in order unless repository evidence provides a strong reason to change the order.
2. Inspect the current repository at the beginning of every phase.
3. Treat the latest committed code as the source of truth.
4. Do not assume earlier implementations are correct.
5. Do not introduce a technology merely for resume keywords.
6. Prefer the smallest correct incremental change.
7. Add regression tests for discovered bugs and test important failure paths.
8. Run actual relevant checks and report their real results.
9. Never invent performance, testing, deployment, or reliability evidence.
10. Update architecture documentation and ADRs when significant decisions are actually made.

## Phase quality gate

Before substantial implementation, record:

```text
Problem
Root cause
Decision
Why this design
Files affected
Risk
Test strategy
```

After implementation, record:

```text
Changed
Tests added/updated
Tests executed
Potential regressions
Remaining technical debt
```

## Stop conditions

Stop and report rather than guessing when:

- a required environment variable is unavailable
- production credentials are required
- destructive migration lacks a safe strategy
- the current repository contradicts a key architectural assumption
- a dependency is unavailable
- tests fail for reasons that cannot be diagnosed confidently
- a migration risks data loss
- an infrastructure operation cannot be safely verified

Complete whatever can be done safely without inventing facts.

## Current baseline note

The repository currently uses a `Backend/` and `Frontend/` layout with Express, MongoDB/Mongoose, Socket.IO, JWT cookies, React, Axios, React Router, and Zustand. Phase 03 now adds explicit backend validation, application errors, centralized error mapping, request IDs, structured request logging, service/repository boundaries where they carry business or persistence responsibility, and health/readiness/liveness endpoints.

The most recent `main` commit is the source of truth for phase execution.
