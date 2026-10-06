# ADR 0018: Prioritize Product UX Before GenAI

## Status

Accepted

## Context

The repository has progressed through the engineering foundation needed for a production-oriented chat system: authentication/session reliability, PostgreSQL persistence, cursor-based API behavior, authenticated Socket.IO, Redis-backed distributed realtime infrastructure, security hardening, automated testing, Docker, CI/CD, Kafka, the Transactional Outbox, observability, and performance/load testing.

The next major gap is the user-facing product experience. Adding GenAI directly to the existing interface before establishing a coherent product UX would create avoidable UI rework and risk making AI feel like a bolt-on feature rather than part of the messaging product.

The previous forward roadmap placed GenAI in Phase 19 and cloud infrastructure in Phase 20. That ordering is no longer the approved product direction.

## Decision

Adopt the following forward sequence:

1. **Phase 19 — Product UX, Frontend Redesign & Core Chat**
2. **Phase 20 — GenAI / AI Chat Participant + Focused RAG**
3. **Phase 21 — AWS / Kubernetes / Terraform + Final Portfolio & Hiring-Manager Review**

Phase 19 establishes the premium product UX and core messaging foundation before AI is introduced. Group conversations are part of the planned Phase 19 scope.

Phase 20 will introduce one focused AI experience as a first-class conversation participant, supported by focused application-specific RAG where justified.

Phase 21 will evaluate and implement the production cloud architecture based on actual operational requirements. Kubernetes remains conditional rather than mandatory.

## Rationale

- AI should be introduced into a stable, coherent product UI.
- AI should be a first-class conversation rather than a disconnected “Ask AI” page.
- Core messaging UX needs a deliberate design system and responsive information architecture.
- Group conversations are a fundamental messaging capability for the planned product direction.
- Establishing the product foundation first reduces future UI rework around AI.
- The sequence prevents uncontrolled WhatsApp-style feature expansion.
- The sequence preserves the project's engineering-first approach: product value is added without prematurely expanding infrastructure.

## Consequences

### Positive

- clearer phase boundaries
- stronger product narrative
- cleaner AI integration point
- reduced future UI rework
- stronger portfolio presentation
- a focused AI scope rather than generic chatbot functionality
- cloud architecture evaluated after the product and AI direction are established

### Tradeoff

GenAI implementation is intentionally delayed until Phase 20.

### Scope boundaries

This ADR does not implement or claim:

- frontend redesign
- group chat
- Google OAuth
- emoji/reactions/typing/read receipts
- AI/RAG
- AWS deployment
- Kubernetes
- Terraform

Those remain future work in their respective phases.

## Alternatives considered

### Keep GenAI as Phase 19

Rejected because the current product experience is the larger user-facing gap and AI would otherwise be integrated into a UI that is expected to change substantially.

### Build the full WhatsApp feature set before AI

Rejected because it would create uncontrolled scope. Phase 19 therefore prioritizes a focused set of high-value messaging capabilities and explicitly defers large media and calling systems.

### Add cloud infrastructure before product work

Rejected because the repository can continue to evolve locally while the product UX and AI integration point are clarified. Cloud infrastructure should be selected from actual deployment requirements rather than resume-driven technology selection.

## Operational and architectural implications

This decision does not change the current runtime architecture or database schema. It changes the sequencing of future product work.

Future Phase 20 architecture must still account for authentication, authorization, privacy, prompt injection, rate limiting, token/cost controls, context management, provider failures, evaluation, testing, and observability.

Future Phase 21 infrastructure decisions must account for operational complexity, security, reliability, scaling, cost, and failure recovery. Kubernetes is not assumed to be required.

## Verification

This ADR records a roadmap/product-direction decision. It does not claim implementation of any Phase 19–21 capability.
