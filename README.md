# 🚀 Monorepo Boilerplate

> Turborepo + Bun · ElysiaJS + Vite/React · PostgreSQL + Drizzle
> Clean Architecture · DDD · CQRS · Event Sourcing · Repository Pattern · Dependency Inversion

---

## Stack

| Layer | Technology |
|---|---|
| Runtime & PM | Bun 1.x |
| Monorepo | Turborepo |
| Backend | ElysiaJS |
| Frontend | Vite + React 19 |
| Database | PostgreSQL + Drizzle |
| Language | TypeScript (strict) |
| Linter/Formatter | Biome |

---

## Monorepo Structure

```
monorepo/
├── apps/
│   ├── api/          # ElysiaJS backend (port 3000)
│   └── web/          # Vite + React frontend (port 5173)
└── packages/
    ├── domain/        # Entities, VOs, Aggregates, Domain Events
    ├── application/   # CQRS Commands/Queries, Ports
    ├── infrastructure/# Drizzle repos, Event Store, Buses, DI Container
    ├── shared/        # Result monad, errors, types
    ├── ui/            # Shared React components
    └── typescript-config/
```

---

## Architecture

```
Presentation (apps/api, apps/web)
    ↓ dispatches Commands/Queries
Application (packages/application)
    ↓ calls Ports (interfaces)
Infrastructure (packages/infrastructure)  ← implements Ports
    ↓ uses
Domain (packages/domain)                  ← zero external deps
```

**Dependency rule:** inner layers never import outer layers.

---

## Quick Start

### 1. Prerequisites
- Bun ≥ 1.3
- PostgreSQL running locally (or Docker)

### 2. Install

```bash
bun install
```

### 3. Environment

```bash
cp .env.example .env
# Edit DATABASE_URL in .env
```

### 4. Database

```bash
bun run --filter @repo/infrastructure db:push   # push schema (no migration files needed)
bun run --filter @repo/infrastructure db:seed    # seeds 3 demo users
```

### 5. Dev

```bash
# Root — runs all apps in parallel via Turborepo
bun run dev

# Or individually:
cd apps/api && bun run dev    # http://localhost:3000
cd apps/web && bun run dev    # http://localhost:5173
```

### 6. API Docs

```
http://localhost:3000/docs   ← Scalar
```

---

## CQRS Flow (Example: Create User)

```
POST /api/users
  → Elysia controller
    → CommandBus.dispatch(CreateUserCommand)
      → CreateUserCommandHandler
          1. IUserRepository.existsByEmail()  ← guard
          2. User.create()                    ← domain aggregate
          3. IUserRepository.save()           ← write model (Drizzle)
          4. IEventStore.append()         ← event store (Drizzle)
          5. IEventBus.publishAll()           ← event bus
        → Result<UserDTO>
      → 201 Created
```

---

## Event Sourcing Architecture

This repo uses a **hybrid approach**:

| Aspect | Pure Event Sourcing | This Repo (Hybrid) |
|--------|--------------------|--------------------|
| Source of truth | Event store | `users` table |
| State rebuild | Replay events | SELECT from `users` |
| Persist mutation | Append events only | UPDATE `users` + append to `event_store` |
| Deletion | Append deletion event | Hard delete |

**Current design:**
- `users` table = write model + source of truth
- `event_store` table = audit log / domain event history
- State is read directly from `users`, not reconstructed from events

**If you need pure event sourcing:**
1. Remove direct `INSERT/UPDATE/DELETE` on `users`
2. Make event store the write model
3. Rebuild read model (projections) from event stream
4. Query reads from projections, not from `users`

**Outbox Pattern:** Events are written to `outbox` table in same transaction as aggregate changes, then processed asynchronously by the outbox processor to ensure reliable event publishing.

---

## Adding a New Bounded Context

1. **Domain** — add `packages/domain/src/<context>/`
2. **Application** — add commands, queries, ports under `packages/application/src/<context>/`
3. **Infrastructure** — add Drizzle model + repo + register in `AppContainer`
4. **API** — add Elysia route group in `apps/api/src/server.ts`

---

## Scripts

| Command | Description |
|---|---|
| `bun run dev` | Start all apps (parallel) |
| `bun run build` | Build all packages & apps |
| `bun run typecheck` | Type check entire monorepo |
| `bun run lint` | Lint entire monorepo |
| `bun run test` | Run all tests (via Turbo) |
| `bun run clean` | Remove all dist + node_modules |
| `bun run --filter @repo/infrastructure db:push` | Push Drizzle schema (dev) |
| `bun run --filter @repo/infrastructure db:seed` | Seed demo users |

---

## Production Deployment with Docker

> **📖 Changelog:** See [`CHANGELOG_DOCKER.md`](./CHANGELOG_DOCKER.md) for a detailed history of all Docker configuration changes — including issues encountered and their fixes.

### Prerequisites

- Docker & Docker Compose (with BuildKit / buildx plugin)
- A PostgreSQL 16+ instance (or let Docker spin one up)
- A Redis 7+ instance (or let Docker spin one up)

### 1. Environment Variables

Create a `.env.production` file in the project root:

```bash
cp .env.example .env.production
```

Edit every variable — production fails fast with clear errors if any are missing:

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string (e.g. `postgresql://user:pass@postgres:5432/db`) |
| `REDIS_URL` | ✅ | Redis connection string (e.g. `redis://:password@redis:6379`). **Must not be the default `redis://localhost:6379` in production.** |
| `CORS_ORIGIN` | ✅ | Frontend origin for CORS headers (e.g. `https://app.example.com`). **Required in production — startup fails without it.** |
| `PORT` | Optional | API port inside container (default: `3000`) |
| `API_PORT` | Optional | Published API port (default: `3000`) |
| `WEB_PORT` | Optional | Published web port (default: `80`) |
| `POSTGRES_PASSWORD` | Optional | PostgreSQL password (default: `postgres`) |
| `REDIS_PASSWORD` | Optional | Redis password (default: `superadmin`) |
| `OUTBOX_INTERVAL` | Optional | Outbox polling interval in ms (default: `5000`) |

Example `.env.production`:

```env
DATABASE_URL="postgresql://postgres:mysecretpass@postgres:5432/monorepo_prod"
REDIS_URL="redis://:myredispass@redis:6379"
CORS_ORIGIN="https://app.example.com"
POSTGRES_PASSWORD=mysecretpass
REDIS_PASSWORD=myredispass
```

> **Single origin example:** `CORS_ORIGIN="https://app.example.com"`
> **Multiple origins:** `CORS_ORIGIN="https://app.example.com,https://admin.example.com"`
> **Regex:** `CORS_ORIGIN="^https?:\/\/(.+\\.)?myapp\\.com$"`

---

### 2. Build & Start

Build all images and boot all services:

```bash
docker compose up --build -d
```

This starts 4 services:

| Service | Image | Description |
|---|---|---|
| `postgres` | `postgres:16-alpine` | Database |
| `redis` | `redis:7-alpine` | Event bus & pub/sub |
| `api` | `Dockerfile` (ElysiaJS) | API server — runs migrations on startup, then boots Elysia |
| `web` | `Dockerfile` (nginx) | Vite + React SPA — served via nginx, proxies `/api/*` to API |

The API container **automatically runs database migrations on startup** via its entrypoint script. No separate migration step needed for first deploy.

To verify all services are healthy:

```bash
docker compose ps
```

---

### 3. Manual Migration (Schema Changes)

For zero-downtime updates or to run migrations independently:

```bash
# Rebuild and run just the migration service
docker compose run --rm --build migration
```

This runs the Drizzle migration runner (`drizzle-orm/node-postgres/migrator`) against the production database — applies any pending SQL migration files inside `packages/infrastructure/drizzle/`.

> **Migration vs push:** The `migration` service uses `drizzle-orm`'s programmatic `migrate()` API, which applies sequential SQL migration files. This is the production-safe approach. The `db:push` command used in local dev (`drizzle-kit push`) compares schema directly and is meant for rapid iteration only.

---

### 4. Rolling Update

After code changes:

```bash
# Rebuild with cache, restart only changed services
docker compose up --build -d
```

If you changed the database schema:

```bash
docker compose up --build -d   # rebuild & restart
docker compose run --rm --build migration  # apply pending migrations
```

> The API container also runs migrations on every startup (via `entrypoint.sh`). So simply restarting the API (`docker compose restart api`) will also apply any pending migrations.

---

### 5. Architecture & Networking

```
Browser ──> :80 ──> nginx ──> /api/* ──> api:3000 (ElysiaJS)
                       │
                       └──> index.html (React SPA)

api:3000 ──> postgres:5432
        ──> redis:6379
```

All services communicate over the default Docker Compose network (`monorepo_default`).

---

### 6. Health Checks

| Service | Check | Interval |
|---|---|---|
| `postgres` | `pg_isready -U postgres` | 5s |
| `redis` | `redis-cli ping` | 5s |
| `api` | `GET /health` via `wget` | 10s |
| `web` | `GET /` via `wget` | 10s |

---

### 7. Troubleshooting

**Build fails with "Workspace dependency not found"**

Make sure the Docker build context includes all necessary workspace packages. The `docker-compose.yml` uses `context: .` (project root), and each `Dockerfile` copies the required packages. If you add a new internal dependency, add the corresponding `COPY` command to the relevant `Dockerfile`.

**API exits immediately with "❌ Invalid environment variables"**

Environment validation runs on startup via Zod. Check the error message — it lists exactly which variable is missing or misconfigured:

```
❌ Invalid environment variables:
   • CORS_ORIGIN: CORS_ORIGIN is required in production — set it to your frontend URL
   • REDIS_URL: REDIS_URL should be explicitly set in production
```

Fix the variable in `.env.production` and restart:

```bash
docker compose up -d
```

**API crashes after startup**

Check logs:

```bash
docker compose logs api --tail 50
```

**Web shows blank page or API requests fail**

- Verify `CORS_ORIGIN` in `.env.production` matches the web domain exactly
- Check nginx logs: `docker compose logs web`
- Verify the API is reachable: `curl http://api:3000/health` (from inside the network)

---

### 8. Useful Commands

```bash
# Full restart (rebuild everything)
docker compose up --build -d

# Restart a single service
docker compose restart api

# View logs
docker compose logs -f api

# Teardown everything (preserves volumes)
docker compose down

# Teardown and delete volumes (fresh state)
docker compose down -v

# Run one-off commands inside a container
docker compose exec api bun run /app/dist/index.js

# Check build image sizes
docker images monorepo-api monorepo-web
```
