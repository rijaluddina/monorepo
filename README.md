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
cd packages/infrastructure
bun run db:migrate     # creates tables
bun run db:seed        # seeds 3 demo users
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
          4. IUserEventStore.append()         ← event store (Drizzle)
          5. IEventBus.publishAll()           ← event bus
        → Result<UserDTO>
      → 201 Created
```

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
| `bun run clean` | Remove all dist + node_modules |
