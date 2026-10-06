# MERN-Chat-App — Engineering Roadmap

**Repository:** `GirishBishwanath/MERN-Chat-App`  
**Execution model:** sequential, evidence-driven, repository-first

This roadmap is the version-controlled execution plan for evolving the chat application into a production-quality full-stack system. Each phase starts by inspecting the current committed repository because previous work may change implementation assumptions.

## Current roadmap

The repository has completed the engineering-foundation sequence through Phase 18. The approved forward sequence now deliberately prioritizes the user-facing product before GenAI and cloud infrastructure:

```text
Engineering foundation
        ↓
Premium product UX + core messaging
        ↓
AI as a first-class conversation participant
        ↓
Cloud/production infrastructure
        ↓
Final portfolio / hiring-manager review
```

The objective is not to build a feature-for-feature WhatsApp clone. The objective is to build a polished, coherent messaging product that demonstrates deep engineering quality and provides a natural foundation for one meaningful AI capability.

## Phases

| Phase | Name | Primary outcome | Status |
|---|---|---|---|
| 1 | Forensic Repository Audit | Verified architecture, severity-ranked findings, migration risks, and execution order | **Complete** |
| 2 | Production Auth & Session Reliability | Server-authoritative authentication, secure cookie/session lifecycle, `/auth/me`, logout and expiry handling | **Implemented; local verification documented** |
| 3 | Backend Architecture / Error / Validation Foundation | Clear backend boundaries, validation, centralized errors, config validation, health/readiness/liveness | **Complete; local verification documented** |
| 4 | TypeScript Migration | Strict TypeScript, domain types, DTOs, API/socket/event contracts | **In progress; current main still contains JavaScript source files** |
| 5 | Frontend Architecture / State Management | Deliberate UI, feature, server-state, client-state, API and realtime boundaries | **Complete; implementation and verification documented** |
| 6 | PostgreSQL Data Model Design | Relational schema, constraints, indexes, access patterns, cursor-pagination design | **Complete; design documented and reviewed** |
| 7 | PostgreSQL Backend & Persistence Foundation | PostgreSQL runtime foundation, migrations, connection management, repositories/data access, transactions, integrity enforcement, and real-PostgreSQL integration testing | **Complete; local verification documented** |
| 8 | Production API / Message Pagination | Stable API contracts, authorization, bounded cursor pagination, consistent errors/statuses | **Implemented in current main; verification not re-run in this documentation task** |
| 9 | Authenticated Realtime / Socket Correctness | Server-authenticated Socket.IO, reconnect/multi-device correctness, deduplication | **Implemented in current main; verification not re-run in this documentation task** |
| 10 | Redis Distributed Use Cases | Justified Redis usage for presence and Socket.IO scaling | **Implemented in current main; integration coverage present** |
| 11 | Security Hardening | Public-exposure security review and regression tests | **Implemented; security hardening and regression coverage present** |
| 12 | Testing System | Layered unit, integration, realtime, API, security, frontend automation, isolation, and coverage foundations | **Complete; repository test architecture and coverage tooling present** |
| 13 | Docker / Local Development | Production-quality images and reproducible local infrastructure | **Implemented; Docker/Compose workflow documented** |
| 14 | GitHub Actions CI/CD | Automated validation, image builds, and immutable container artifact publication | **Implemented; CI/CD workflow documented** |
| 15 | Kafka / Event-Driven Architecture | Meaningful domain events, typed envelopes, topic/partition semantics, notification consumer, failure handling, and integration coverage | **Implemented; CI verification documented** |
| 16 | Outbox / Idempotent Consumers / Reliability | Transactional outbox, duplicate safety, retries, DLQ, ordering, and failure-mode tests | **Complete; CI verification documented** |
| 17 | Observability / Incident Debugging | Structured telemetry and actionable production diagnosis | **Complete; CI verification documented** |
| 18 | Performance / Load Testing | Real measurements, bottleneck identification, reproducible before/after results | **Complete; final clean benchmark evidence documented** |
| 19 | Product UX, Frontend Redesign & Core Chat | Premium product experience, responsive messaging UX, group conversations, and selected high-value messaging features | **NEXT** |
| 20 | GenAI / AI Chat Participant + Focused RAG | An authenticated AI participant integrated as a normal conversation, grounded by focused application knowledge | **Planned** |
| 21 | AWS / Kubernetes / Terraform + Final Portfolio & Hiring-Manager Review | Justified production cloud architecture, reproducible infrastructure, and final portfolio/hiring review | **Planned** |

## Execution rules

1. Run phases one at a time and in order unless repository evidence provides a strong engineering reason to change the sequence.
2. Inspect the current repository at the beginning of every phase.
3. Treat the latest committed code as the source of truth.
4. Do not assume earlier implementations are correct merely because documentation says they are complete.
5. Do not introduce technology merely for resume keywords.
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

## Phase-status reconciliation notes

### Phases 1–7

The historical Phase 1–7 records are retained. Phase 4 remains intentionally open because the current repository is not yet a complete TypeScript migration: JavaScript source files remain in both backend and frontend areas. The existence of substantial TypeScript coverage does not by itself make the strict migration complete.

### Phases 8–11

The current `main` repository contains the production API cursor utilities and API integration coverage, server-authenticated Socket.IO infrastructure, Redis cross-instance adapter/presence infrastructure, and security-hardening middleware/tests. These are therefore no longer accurately represented as merely pending phases. This documentation task does not re-run the application test suite, so no new verification claim is made here.

### Phase 12

The repository contains an authoritative backend regression command, PostgreSQL/Redis/Socket.IO integration coverage, security regression coverage, Vitest + React Testing Library frontend automation, isolation/cleanup rules, and Node test coverage instrumentation. Browser E2E remains intentionally deferred because the repository does not yet provide a reproducible browser/backend/infrastructure lifecycle.

### Phase 13–14

Docker/Compose and GitHub Actions CI/CD are implemented in the current repository. Phase 14 publishes immutable container artifacts to GHCR but does not claim AWS/Kubernetes production deployment.

### Phases 15–17

Kafka domain events, the Transactional Outbox, idempotent notification consumption, structured observability, health/readiness/liveness, and targeted infrastructure telemetry are implemented and documented. Their historical phase documents remain unchanged.

### Phase 18

Phase 18 is complete on the current `main` commit. The dedicated Phase 18 document records reproducible local k6 HTTP/WebSocket workloads, synthetic data generation, PostgreSQL query-plan analysis, an evidence-backed outbox bottleneck, the resulting optimization, and two final clean message-send runs with zero HTTP failures and zero residual outbox backlog. Those measurements remain local benchmark evidence rather than production-capacity claims.

See [Phase 18 — Performance Engineering](PHASE-18-PERFORMANCE.md).

## Approved forward roadmap

### Phase 19 — Product UX, Frontend Redesign & Core Chat

**Status: NEXT**

Phase 19 is not merely a CSS redesign. It transforms the technically mature backend into a polished, modern, responsive messaging product.

#### Product and visual foundation

Planned scope includes:

- premium visual redesign
- new product branding direction
- eventual product name
- logo direction
- design system
- typography
- colors
- spacing
- buttons and inputs
- avatars and message bubbles
- menus and dialogs/modals
- toast/notification UI
- loading and skeleton states
- empty states
- error states
- accessibility improvements
- desktop, tablet, mobile, and small-screen layouts

The final product name, logo, and design system are intentionally undecided until the Phase 19 product/UX audit and implementation.

#### Authentication UX

Planned areas include:

- login
- registration
- forgot password
- reset password
- authentication/session loading states
- authenticated/unauthenticated transitions
- responsive authentication screens
- **Google OAuth as a planned/candidate Phase 19 capability**, subject to the repository audit and an explicit implementation decision

Google OAuth is not currently documented as an implemented feature.

#### Core chat

Direct messaging will be preserved and polished.

Group conversations are an explicit Phase 19 requirement. Planned group capabilities include, where justified by the repository audit:

- selecting multiple users
- group creation
- group name
- optional group avatar
- group conversation
- group member list
- adding members
- removing members
- leaving a group
- basic creator/admin semantics
- group message authorization
- group typing indicators
- group read/delivery semantics where appropriate
- responsive group UI
- group notifications where appropriate

Group chat is planned scope, not an implemented feature.

#### High-value messaging features

**High priority**

- emoji picker
- message reactions
- typing indicators
- delivery status
- read receipts
- online status
- last seen
- group conversations

**Strong/medium priority**

- edit message
- delete message
- message search
- notifications
- Google OAuth

The exact implementation order will be determined by the Phase 19 repository/product audit. Listing a feature here does not mean it already exists.

#### Responsive acceptance criteria

Responsive behavior is a first-class acceptance criterion across:

- desktop
- laptop
- tablet
- mobile
- small mobile

The intended interaction model is:

```text
Desktop:
Conversation list + conversation panel

Mobile:
Conversation list
    ↓
Conversation view
    ↓
Back navigation to conversation list
```

The implementation should deliberately adapt information architecture and interaction, not merely add mobile CSS.

#### Explicitly deferred from Phase 19

Phase 19 must not become an uncontrolled WhatsApp-style clone.

Large media and calling systems are deferred, including:

- arbitrary file-storage architecture
- large file uploads
- video uploads
- voice messages
- audio calls
- video calls
- WebRTC
- TURN/STUN infrastructure
- call signaling architecture
- call quality management

These may become later product enhancements, but they are not Phase 19 completion requirements.

### Phase 20 — GenAI / AI Chat Participant + Focused RAG

**Status: PLANNED**

The central product decision is:

> The AI will be a first-class conversation participant inside the messaging application, not a disconnected “Ask AI” page.

Conceptually, conversations may eventually include:

```text
🤖 AI
👤 Alice
👤 Bob
👥 Engineering Team
```

The future conceptual conversation types are:

```text
DIRECT
GROUP
AI
```

This is future product/architecture direction. No schema or implementation change is made by this roadmap update.

#### AI scope

The project should build one excellent AI experience:

> An authenticated AI assistant that users can open and chat with as a normal conversation inside the messaging application.

The final AI name/brand remains undecided until Phase 19 product/branding work.

The roadmap intentionally excludes unrelated AI personas, autonomous agents, voice AI, and generic feature sprawl.

#### Focused RAG

RAG exists to support the AI participant rather than becoming the entire product.

The initial knowledge domain should remain focused on approved application-specific material such as:

- ChatApp documentation
- help content
- feature documentation
- user guidance
- approved product knowledge

Conceptually:

```text
Approved ChatApp knowledge
        ↓
Knowledge ingestion
        ↓
Chunking
        ↓
Retrieval
        ↓
Relevant context
        ↓
AI
        ↓
Grounded response
```

No specific vector database, embedding provider, LLM provider, or RAG infrastructure is finalized by this roadmap.

#### Production AI requirements

Future Phase 20 design must explicitly address:

- authentication
- authorization
- privacy
- prompt injection
- rate limiting
- token/cost controls
- conversation history
- context management
- streaming
- timeouts
- provider failures
- fallback behavior
- model/provider selection
- evaluation
- automated testing
- observability
- metrics/logging
- prompt/version management
- ADRs

The final implementation should be chosen only after the Phase 20 repository/product audit.

### Phase 21 — AWS / Kubernetes / Terraform + Final Portfolio & Hiring-Manager Review

**Status: PLANNED**

Planned areas include, where justified:

- AWS architecture
- Terraform
- production Docker
- production CI/CD
- secrets/configuration management
- production PostgreSQL
- production Redis
- Kafka production decision
- observability
- health/readiness
- scaling
- security review
- cost review
- failure/disaster considerations
- architecture documentation
- README review
- architecture diagrams
- ADR review
- portfolio review
- hiring-manager review

Kubernetes remains conditional. It must not be introduced merely for resume keywords. The final cloud architecture must be justified by actual operational requirements, failure modes, scaling needs, and cost/complexity tradeoffs.

## Documentation boundaries

This roadmap distinguishes four kinds of statements:

1. **Historical record** — what a completed phase actually implemented and verified.
2. **Current roadmap** — the authoritative order and status of upcoming work.
3. **Future architecture** — an explicitly planned direction that has not been implemented.
4. **Implemented functionality** — behavior demonstrable in the current repository.

Historical phase documents are not rewritten merely to make old planning language match the new roadmap. Factual corrections are appropriate only when a historical document is actually inaccurate.

## Related documentation

- [Master Engineering Prompt](MASTER_ENGINEERING_PROMPT.md)
- [Phase 18 — Performance Engineering](PHASE-18-PERFORMANCE.md)
