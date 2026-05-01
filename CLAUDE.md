# CLAUDE.md

Repo code work guidance.

## Quick Commands

### Root (Turborepo)
- `bun run dev` — start apps (api:3000, web:5173)
- `bun run build` — build packages + apps
- `bun run typecheck` — type monorepo
- `bun run lint` — lint (Biome)
- `bun run check` — Biome check + fix

### Database (infrastructure)
- `bun run db:migrate` — apply Drizzle migrations
- `bun run db:seed` — seed 3 demo users

### Single app
- `cd apps/api && bun run dev` — ElysiaJS backend
- `cd apps/web && bun run dev` — Vite + React frontend

### Single test
- `cd <package> && bun test <file>` — Bun runner

## Architecture

Clean Architecture + DDD + CQRS + Event Sourcing. Turborepo + Bun.

### Dependency Rule (strict)
Inner layers NO import outer:

```
Presentation (apps/api, apps/web)
    ↓ dispatch Cmd/Query
Application (packages/application)
    ↓ call Ports (interfaces)
Infrastructure (packages/infrastructure) ← implement Ports
    ↓ use
Domain (packages/domain) ← zero deps
```

### Package Map

| Package | Role |
|---------|------|
| `domain` | Entities, VOs, Aggregates, Domain Events. Pure TS, zero deps. |
| `application` | CQRS Cmd/Query + Handlers, Port interfaces (`IUserRepository`) |
| `infrastructure` | Drizzle repos (write model), Event Store, Buses, DI (`AppContainer`) |
| `shared` | `Result` monad, error classes, shared types. |
| `ui` | Shared React components. |
| `api` | ElysiaJS routes → CQRS bus. No biz logic. |
| `web` | Vite + React 19 frontend. Consumes API. |

### Key Patterns

**Result Monad** (`packages/shared/src/result.ts`): Biz errors return `Err`. Handle `Ok`/`Err`.

**Dependency Inversion** (`packages/infrastructure/src/container/app-container.ts`): `AppContainer` composition root. Wire abstractions to impls.

**CQRS Flow** (create user):
```
POST /api/users
  → Elysia controller (apps/api)
    → CommandBus.dispatch(CreateUserCommand)
      → CreateUserCommandHandler (packages/application)
          1. IUserRepository.existsByEmail() — guard
          2. User.create() — aggregate emit events
          3. IUserRepository.save() — write model (Drizzle)
          4. IEventStore.append() — event store (Drizzle)
          5. IEventBus.publishAll() — event bus
        → Result<UserDTO>
      → 201 Created
```

**Event Sourcing**: Domain events in aggregate, append `event_store` table, publish bus.

## Adding New Bounded Context

1. **Domain** — `packages/domain/src/<context>/` (entities, VOs, events)
2. **Application** — `packages/application/src/<context>/` (cmd, query, handlers, ports)
3. **Infrastructure** — Drizzle model + repo + register `AppContainer`
4. **API** — add Elysia route group `apps/api/src/server.ts`

## Tech Stack

| Layer | Tech |
|-------|-----|
| Runtime | Bun 1.x |
| Monorepo | Turborepo |
| Backend | ElysiaJS (:3000) |
| Frontend | Vite + React 19 (:5173) |
| Database | PostgreSQL + Drizzle |
| Language | TypeScript (strict) |
| Lint/Format | Biome |

## Environment

Copy `.env.example` to `.env`. Keys: `DATABASE_URL`, `VITE_API_URL`.

## Notes

- Manager: **Bun**. Use `bun run <script>`.
- API docs: http://localhost:3000/docs (Scalar).
- Inter-package imports: `@repo/*` scope.
- Drizzle schema: `packages/infrastructure/src/database/schema.ts`.
