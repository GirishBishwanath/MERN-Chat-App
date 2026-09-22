# ADR 003: Docker-based local development

## Context

The application depends on PostgreSQL and Redis in addition to its Node.js API and React/Vite frontend. Host-based setup requires developers to reproduce database, Redis, runtime, ports, and process startup configuration manually.

Phase 13 is intended to make the local runtime reproducible without introducing later-phase infrastructure.

## Decision

Use Docker Compose as the local development orchestrator for four services:

1. PostgreSQL
2. Redis
3. backend
4. frontend

Use bind mounts for application source code during development and anonymous `node_modules` volumes so host dependencies are not copied into containers.

Use explicit PostgreSQL migrations rather than running destructive or schema-changing operations automatically at application startup.

Keep Redis ephemeral in local development because its current responsibilities are presence, Socket.IO distribution, and rate limiting rather than persistent business storage.

Provide multi-stage backend and frontend Dockerfiles so the repository also has understandable production image targets without making production deployment part of Phase 13.

## Alternatives considered

### Infrastructure-only Compose

Pros:
- less configuration
- preserves the host Node/Vite workflow

Cons:
- runtime version and application process setup remain host-dependent
- container networking is not exercised
- a clean checkout is not fully reproducible

### Backend-only container

Pros:
- tests backend container networking

Cons:
- frontend remains host-dependent
- local development topology is split across host and containers

### Full Compose development stack

Selected because it reproduces the complete local runtime while preserving Vite hot reload through bind mounts.

## Consequences

Positive:

- PostgreSQL and Redis installation are no longer prerequisites for the Docker workflow.
- Compose service names exercise the container-networking model.
- Startup dependencies are expressed through health checks.
- Local database persistence is explicit.
- Development and production image concerns remain separate.

Costs:

- Docker Desktop is required for the containerized workflow.
- Bind mounts can be slower on Windows/WSL.
- Developers must understand container logs, volumes, and service names.
- The frontend needs separate browser-facing and container-facing backend URLs.

## Testing approach

The intended verification lifecycle is:

```text
docker compose build
→ docker compose up
→ verify postgres/redis health
→ run migrations
→ verify API liveness/readiness
→ verify frontend
→ exercise API/socket connectivity
→ docker compose down
```

The existing backend and frontend test suites remain regression gates and are not weakened for Docker.
