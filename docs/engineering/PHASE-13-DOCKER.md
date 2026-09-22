# Phase 13 — Docker and Local Development

## Scope

Phase 13 establishes a reproducible Docker-based local runtime for the existing PostgreSQL, Redis, Node.js API, and React/Vite application.

It does not introduce CI/CD, Kafka, AWS, Kubernetes, Terraform, load testing, or GenAI.

## Decision

The repository uses one `compose.yaml` for local development with four services:

- `postgres`: PostgreSQL 16.10 with a persistent named volume
- `redis`: Redis 7.4.11 with intentionally ephemeral local state
- `backend`: Node.js/Express API using the existing TypeScript runtime
- `frontend`: React/Vite development server

The frontend remains Vite-based in development so hot reload is preserved. Browser JavaScript uses `http://localhost:4002` for API and Socket.IO traffic, while the Vite server proxies `/api` requests to the Compose service name `backend:4002`.

This split is deliberate: `backend` is resolvable only inside the Compose network, while browser JavaScript executes outside that network.

## Why Compose

The repository already depends on PostgreSQL and Redis. Docker removes the need for each developer to install and configure those infrastructure services manually and gives the application a deterministic service topology.

A simpler infrastructure-only Compose setup was considered. It would reproduce PostgreSQL and Redis but leave Node/npm versions, process startup, and container networking to individual developers. The complete four-service development stack provides stronger reproducibility without introducing another orchestration layer.

Kafka is not included because it belongs to Phase 15.

## Service topology

```text
Browser
  |
  | http://localhost:3001
  v
Vite frontend container
  |
  | /api -> http://backend:4002
  v
Express API container
  |                         |
  | postgres:5432           | redis:6379
  v                         v
PostgreSQL container      Redis container
```

The browser connects directly to the published backend port for Socket.IO:

```text
Browser -> http://localhost:4002 -> Socket.IO
```

## Startup

Prerequisites:

- Docker Desktop with Docker Compose v2
- Git
- Node/npm only if using the host-based development workflow

Optional:

```bash
cp .env.docker.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.docker.example .env
```

Start the complete local stack:

```bash
docker compose up --build
```

Run migrations explicitly after the stack is healthy:

```bash
docker compose run --rm backend npm run db:migrate
```

The Compose file requires `POSTGRES_PASSWORD` and `JWT_SECRET` to be supplied through the local `.env` file or shell environment. The backend does not automatically run destructive or schema-changing migrations on startup.

## Useful commands

```bash
docker compose up -d
docker compose logs -f
docker compose logs -f backend
docker compose ps
docker compose down
docker compose build --no-cache
docker compose exec backend sh
```

Reset the local database intentionally:

```bash
docker compose down -v
docker compose up --build
docker compose run --rm backend npm run db:migrate
```

`docker compose down -v` deletes the local PostgreSQL named volume and therefore destroys local development data.

## Database lifecycle

PostgreSQL data persists in the `postgres-data` named volume.

Migrations are explicit:

```bash
docker compose run --rm backend npm run db:migrate
```

The production image also contains compiled migrations and exposes:

```bash
npm run db:migrate:prod
```

No startup hook automatically drops tables or resets data.

## Redis lifecycle

Redis is used for the existing ephemeral/distributed responsibilities:

- Socket.IO adapter
- presence
- authentication rate limiting

No persistent business records are stored in Redis.

The local Compose Redis service has no data volume. Removing/recreating the Redis container therefore clears local ephemeral state, which is consistent with its role.

## Health and readiness

`/health/live` answers whether the API process is alive.

`/health/ready` verifies both PostgreSQL and Redis connectivity and returns HTTP 503 with a generic dependency-unavailable response when either required dependency is unavailable.

Compose uses dependency health checks before starting the backend. The backend also verifies PostgreSQL and Redis during startup.

## Docker image strategy

### Backend

`Backend/Dockerfile` provides:

- `development`: TypeScript runtime with source bind mounts
- `build`: deterministic dependency installation and TypeScript build
- `production`: dependency-pruned Node runtime with compiled output and migrations

### Frontend

`Frontend/Dockerfile` provides:

- `development`: Vite development server with container-friendly host binding
- `build`: Vite production build
- `production`: Nginx static runtime with SPA fallback

The production frontend image does not require a Node process to serve static assets.

## Windows development

The Compose frontend sets `VITE_USE_POLLING=true` by default because bind-mounted file watching can be unreliable or slow on Windows/WSL-backed Docker environments.

If file watching works without polling, set:

```text
VITE_USE_POLLING=false
```

Polling consumes more CPU, so it is an explicit development tradeoff rather than a universal requirement.

## Security properties

- No `.env` file is copied into images.
- Docker build contexts exclude local secrets, dependencies, logs, and generated artifacts.
- Application containers run as the non-root `node` user where the runtime permits it.
- Production runtime images install only production dependencies.
- Local database credentials are development-only.
- No production credential is stored in Compose.

These properties are not a claim that the images are production-secure merely because they are containerized.

## Troubleshooting

### Port already in use

Check ports 3001, 4002, 5432, and 6379. Published PostgreSQL and Redis ports can be changed with `POSTGRES_PORT_PUBLISHED` and `REDIS_PORT_PUBLISHED`.

### Backend is unhealthy

```bash
docker compose logs backend
docker compose logs postgres
docker compose logs redis
```

Then check:

```bash
curl http://localhost:4002/health/live
curl http://localhost:4002/health/ready
```

### Migration fails

```bash
docker compose run --rm backend npm run db:migrate
```

Do not delete the PostgreSQL volume unless the goal is explicitly to reset local data.

### Frontend cannot reach the API

Verify:

- backend is healthy
- `VITE_BACKEND_URL` is `http://localhost:4002`
- `VITE_DEV_PROXY_TARGET` is `http://backend:4002`
- browser is not using a stale Vite process

### Socket.IO cannot connect

Verify port 4002 is published and the backend is healthy. Socket.IO authentication uses the existing HttpOnly access cookie; no client-supplied user ID is used as authentication evidence.

## Verification boundary

Docker-specific lifecycle commands must be executed on a machine with Docker Desktop/Compose available. The repository's Phase 12 test contract remains unchanged.

Phase 13 should not be marked complete until Docker build/start/migration/health/frontend/shutdown verification has actually been executed.
