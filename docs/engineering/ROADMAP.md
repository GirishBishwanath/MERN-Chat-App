# MERN-Chat-App — Engineering Roadmap

**Repository:** `GirishBishwanath/MERN-Chat-App`  
**Execution model:** sequential, evidence-driven, repository-first

This roadmap is the version-controlled execution plan for evolving the chat application into a production-quality full-stack system. Each phase starts by inspecting the current committed repository because previous work may change implementation assumptions.

## Phases

| Phase | Name | Primary outcome | Status |
|---|---|---|---|
| 1 | Forensic Repository Audit | Verified architecture, severity-ranked findings, migration risks, and execution order | **Complete** |
| 2 | Production Auth & Session Reliability | Server-authoritative authentication, secure cookie/session lifecycle, `/auth/me`, logout and expiry handling | **Implemented; verification completed locally** |
| 3 | Backend Architecture / Error / Validation Foundation | Clear backend boundaries, validation, centralized errors, config validation, health/readiness/liveness | **Complete; 17/17 backend tests passed locally** |
| 4 | TypeScript Migration | Strict TypeScript, domain types, DTOs, API/socket/event contracts | **In progress; backend foundation/auth slice migrated** |
| 5 | Frontend Architecture / State Management | Deliberate UI, feature, server-state, client-state, API and realtime boundaries | **Complete; implementation and local verification complete** |
| 6 | PostgreSQL Data Model Design | Relational schema, constraints, indexes, access patterns, cursor-pagination design | **Complete; design documented and reviewed** |
| 7 | PostgreSQL Backend & Persistence Foundation | PostgreSQL runtime foundation, migrations, connection management, repositories/data access, transactions, integrity enforcement, and real-PostgreSQL integration testing | **Pending** |
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
- destructive data operations lack a safe strategy
- the current repository contradicts a key architectural assumption
- a dependency is unavailable
- tests fail for reasons that cannot be diagnosed confidently
- an infrastructure operation cannot be safely verified

Complete whatever can be done safely without inventing facts.

## Current baseline note

The repository currently uses a `Backend/` and `Frontend/` layout with Express, MongoDB/Mongoose, Socket.IO, JWT cookies, React, Axios, React Router, and Zustand. Phase 03 adds explicit backend validation, application errors, centralized error mapping, request IDs, structured request logging, service/repository boundaries where they carry business or persistence responsibility, and health/readiness/liveness endpoints.

Phase 03 local verification is complete: the backend test command `node --test auth/*.test.js middleware/*.test.js` passed all 17 tests with zero failures.

Phase 04 is currently being developed on `feat/typescript-migration`. The first slice establishes strict backend TypeScript configuration and migrates environment configuration, the application error contract, structured logger, request/validation/error middleware, user/session persistence boundaries, authentication/session lifecycle, user service/controller/routes, and typed authenticated request contracts. PostgreSQL and distributed infrastructure remain untouched.

Phase 07 is intentionally being restarted from the clean Phase 06 baseline after the previous MongoDB-to-PostgreSQL migration approach was abandoned. The new phase establishes PostgreSQL as the backend persistence foundation from scratch; it does not include a MongoDB data importer, migration pipeline, or dual-write migration mechanism.
