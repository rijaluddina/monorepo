# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Commands

### Run from root (Turborepo pipelines)
- `bun run dev` — start all apps (api :3000, web :5173)
- `bun run build` — build all packages & apps
- `bun run typecheck` — type check entire monorepo
- `bun run lint` — lint with Biome
- `bun run check` — Biome check + auto-fix

### Database (delegates to infrastructure)
- `bun run db:migrate` — apply Drizzle migrations
- `bun run db:seed` — seed 3 demo users

### Single app
- `cd apps/api && bun run dev` — ElysiaJS backend
- `cd apps/web && bun run dev` — Vite + React frontend

### Single test (no test runner configured yet; use this when added)
- `cd <package> && bun test <file>` — Bun test runner

## Architecture

Clean Architecture + DDD + CQRS + Event Sourcing. Monorepo powered by Turborepo + Bun.

### Dependency Rule (strict)
Inner layers NEVER import outer layers:

```
Presentation (apps/api, apps/web)
    ↓ dispatches Commands/Queries
Application (packages/application)
    ↓ calls Ports (interfaces)
Infrastructure (packages/infrastructure) ← implements Ports
    ↓ uses
Domain (packages/domain) ← zero external deps
```

### Package Map

| Package | Role |
|---------|------|
| `domain` | Entities, Value Objects, Aggregates, Domain Events. Pure TS, zero deps. |
| `application` | CQRS Commands/Queries + Handlers, Port interfaces (`IUserRepository`, etc.) |
| `infrastructure` | Drizzle repos (write model), Event Store, Buses, DI Container (`AppContainer`) |
| `shared` | `Result` monad, error classes, shared types. Cross-layer. |
| `ui` | Shared React components (Button, etc.) |
| `api` | ElysiaJS routes → CQRS bus only. No business logic. |
| `web` | Vite + React 19 frontend. Consumes API. |

### Key Patterns

**Result Monad** (`packages/shared/src/result.ts`): Business errors return `Err`, never throw. Caller must handle both `Ok`/`Err`.

**Dependency Inversion** (`packages/infrastructure/src/container/app-container.ts`): `AppContainer` is composition root. Single place wiring abstractions to implementations.

**CQRS Flow** (create user example):
```
POST /api/users
  → Elysia controller (apps/api)
    → CommandBus.dispatch(CreateUserCommand)
      → CreateUserCommandHandler (packages/application)
          1. IUserRepository.existsByEmail() — guard
          2. User.create() — domain aggregate emits events
          3. IUserRepository.save() — write model (Drizzle)
          4. IUserEventStore.append() — event store (Drizzle)
          5. IEventBus.publishAll() — event bus
        → Result<UserDTO>
      → 201 Created
```

**Event Sourcing**: Domain events collected in aggregate, appended to `event_store` table, published to event bus.

## Adding a New Bounded Context

1. **Domain** — `packages/domain/src/<context>/` (entities, VOs, events)
2. **Application** — `packages/application/src/<context>/` (commands, queries, handlers, ports)
3. **Infrastructure** — Drizzle model + repo + register in `AppContainer`
4. **API** — add Elysia route group in `apps/api/src/server.ts`

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

Copy `.env.example` to `.env`. Key vars: `DATABASE_URL`, `VITE_API_URL`.

## Notes

- Package manager is **Bun**, not npm/yarn/pnpm. Use `bun run <script>`.
- API docs at http://localhost:3000/docs (Swagger UI).
- Inter-package imports use `@repo/*` scope (workspaces).
- Drizzle schema: `packages/infrastructure/src/database/schema.ts`.
