# 💬 Real-Time MERN Chat Application

![Stack](https://img.shields.io/badge/Stack-MERN-green)
![Realtime](https://img.shields.io/badge/Feature-RealTime-blue)
![Auth](https://img.shields.io/badge/Auth-Session%20%2B%20JWT-orange)

A full-stack real-time messaging platform enabling communication with server-authoritative authentication and live updates.

🔗 **Live Demo:** [mern-chat-app-jade.vercel.app](https://mern-chat-app-jade.vercel.app)
📦 **Repo:** [github.com/GirishBishwanath/MERN-Chat-App](https://github.com/GirishBishwanath/MERN-Chat-App)

---

## 🚀 Key Features

- **Real-Time Messaging:** Implemented using **Socket.IO** for message delivery and live user connectivity.
- **Online User Tracking:** Maintains active user sessions and dynamically updates online/offline status.
- **Server-Authoritative Authentication:** Short-lived JWT access cookies plus persistent refresh sessions stored server-side.
- **Secure Cookies:** Authentication credentials are stored in HttpOnly cookies and are never read by frontend JavaScript.
- **Session Lifecycle:** Includes `/me`, refresh, logout, and logout-all-devices server endpoints with session expiration and revocation.
- **Password Security:** Passwords are hashed with bcrypt and confirmation credentials are not persisted.
- **Modern Frontend Architecture:** Authentication state has an explicit `loading`, `authenticated`, and `unauthenticated` lifecycle.

## 🛠️ Tech Stack

- **Frontend:** React.js, Tailwind CSS, Axios
- **Backend:** Node.js, Express.js, Socket.IO
- **Database:** PostgreSQL
- **Ephemeral/distributed state:** Redis (presence, Socket.IO adapter, authentication rate limiting)
- **Authentication:** JWT access credentials, PostgreSQL-backed refresh sessions, bcrypt

---

## 🔐 Authentication Architecture

The browser is not the authority for authentication.

```text
Browser
  │
  │ HttpOnly cookies
  ▼
Express API
  │
  ├── accessToken (15 minutes)
  │     └── JWT → user identity
  │
  └── refreshToken (30 days)
        └── SHA-256 hash stored in PostgreSQL Session

Page load
  → GET /api/user/me
  → if access token expired: POST /api/user/refresh
  → authenticated / unauthenticated

Logout
  → revoke refresh session
  → clear both cookies

Logout all devices
  → delete all sessions for the authenticated user
  → clear current cookies
```

The refresh token is opaque and only its SHA-256 hash is persisted. Refresh updates the session's `lastUsedAt` value and issues a new short-lived access token. The refresh token itself is deliberately stable for the lifetime of the server-side session to avoid multi-tab/device rotation races; the session expires after 30 days unless revoked.

For production cross-domain deployment, authentication cookies use `HttpOnly`, `Secure`, and `SameSite=None`. Local development uses `Secure=false` and `SameSite=Lax` so cookies work over HTTP localhost.

---

## ☁️ Deployment

- **Frontend:** Vercel
- **Backend:** Render (persistent Node service for Socket.IO)
- **Database:** PostgreSQL

The root `render.yaml` configures the backend deployment.

Render backend environment variables:
- `POSTGRES_HOST`
- `POSTGRES_PORT`
- `POSTGRES_DATABASE`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `REDIS_URL`
- `JWT_SECRET`
- `CORS_ORIGINS`

Vercel frontend environment variable:
- `VITE_BACKEND_URL`

---

## 📁 Project Structure

```text
MERN-Chat-App/
├── Backend/
│   ├── app.ts
│   ├── index.ts
│   ├── auth/
│   ├── config/
│   ├── controller/
│   ├── db/
│   ├── errors/
│   ├── infra/redis/
│   ├── middleware/
│   ├── repositories/postgres/
│   ├── routes/
│   ├── services/
│   ├── SocketIO/
│   ├── test/
│   ├── utils/
│   └── validation/
├── Frontend/
│   └── src/
├── docs/
│   ├── adr/
│   └── engineering/
└── README.md
```

---

## ⚙️ Setup & Installation

1. Clone the repository
```bash
git clone https://github.com/GirishBishwanath/MERN-Chat-App
cd MERN-Chat-App
```

2. Install dependencies
```bash
cd Backend && npm install
cd ../Frontend && npm install
```

3. Configure backend environment variables

Create `Backend/.env` from `Backend/.env.example`:
```env
PORT=4002
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5432
POSTGRES_DATABASE=mern_chat_app
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_local_postgres_password
REDIS_URL=redis://127.0.0.1:6379
JWT_SECRET=your_long_random_jwt_secret
NODE_ENV=development
CORS_ORIGINS=http://localhost:3001
```

> ⚠️ Never commit your `.env` file.

Create `Frontend/.env` with the backend URL used by the frontend development proxy:
```env
VITE_BACKEND_URL=http://localhost:4002
```

4. Run the application
```bash
# Backend
cd Backend
npm start

# Frontend (in a separate terminal)
cd Frontend
npm run dev
```

For production, set the actual deployed backend URL in `VITE_BACKEND_URL` and include the deployed frontend origin in `CORS_ORIGINS`.

## 🐳 Docker Local Development

Phase 13 adds a reproducible Docker Compose workflow for the complete local runtime:

```text
Browser
   │
   ├── localhost:3001 → Frontend/Vite
   │                     │
   │                     └── /api → backend:4002
   │
   └── localhost:4002 → Backend/Socket.IO
                           │
                           ├── postgres:5432 → PostgreSQL
                           └── redis:6379   → Redis
```

Prerequisite: Docker Desktop with Docker Compose v2.

Create the required local Docker environment file:

```bash
cp .env.docker.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.docker.example .env
```

Start the complete development stack:

```bash
docker compose up --build
```

Run PostgreSQL migrations explicitly:

```bash
docker compose run --rm backend npm run db:migrate
```

The application is available at:

- Frontend: http://localhost:3001
- Backend: http://localhost:4002
- Liveness: http://localhost:4002/health/live
- Readiness: http://localhost:4002/health/ready

Useful commands:

```bash
docker compose ps
docker compose logs -f
docker compose down
docker compose build --no-cache
```

To intentionally delete the local PostgreSQL volume and recreate the database:

```bash
docker compose down -v
docker compose up --build
docker compose run --rm backend npm run db:migrate
```

**Warning:** `docker compose down -v` destroys local PostgreSQL development data.

Inside Compose, the backend connects to `postgres` and `redis` by service name. The browser-facing `VITE_BACKEND_URL` remains `http://localhost:4002` so Socket.IO can connect from the browser. The Vite proxy uses `VITE_DEV_PROXY_TARGET=http://backend:4002` for container-to-container API traffic.

See [Phase 13 Docker and local development](docs/engineering/PHASE-13-DOCKER.md) and [ADR 003](docs/adr/003-docker-local-development.md) for the implemented architecture and troubleshooting workflow.

## 🧪 Testing

The backend uses Node's built-in `node:test` runner with real PostgreSQL and Redis integration tests where infrastructure semantics matter.

From `Backend/`:

```bash
npm test
```

The authoritative command runs the unit, API integration, PostgreSQL, Redis, Socket.IO, and security suites in sequence.

Focused commands:

```bash
npm run test:unit
npm run test:api
npm run test:postgres
npm run test:redis
npm run test:socket
npm run test:security
```

PostgreSQL and Redis tests use local test infrastructure and synthetic credentials. See `docs/engineering/PHASE-12-TESTING.md` for the testing architecture and current limitations.
