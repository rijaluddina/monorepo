# AGENTS.md

## Critical Commands

### Test suite
- **Always** `bun run test` from root (Turbo). Do NOT run `bun test` from root — it fails on Web (no DOM).
- `packages/*` and `apps/api`: `bun test`
- `apps/web`: `vitest`

### CI order
`lint → typecheck → db:push → test`
```bash
bun run lint
bun run typecheck
bun run --filter @repo/infrastructure db:push   # push schema, NOT migrate
bun run test
```

### DB commands (infrastructure package)
- `db:push` — push schema (used by CI, no migration files needed)
- `db:migrate` — run Drizzle migrations (requires migrations folder)
- `db:seed` — seed demo users

### Dev servers
- Root: `bun run dev` (starts api:3000, web:5173 in parallel)
- Single: `cd apps/api && bun run dev` or `cd apps/web && bun run dev`

## Key Gotchas

### Package manager
Use `bun` everywhere. `bun install --frozen-lockfile` in CI.

### Biome style (in biome.json)
- `quoteStyle: "double"` — strings use double quotes
- `trailingCommas: "all"` — trailing commas on multi-line arrays/objects
- `semicolons: true` — always semicolons

### Dependency rule (strict)
`domain` → `application` → `infrastructure`. **Never** import inward. `domain` has zero external deps.

### Inter-package imports
Use `@repo/{package}` scope (e.g., `@repo/domain`, `@repo/application`).

### Hybrid event sourcing
`users` table is source of truth. `event_store` is audit log. State is read from `users`, not reconstructed from events.

### Result monad
Use `Result` from `@repo/shared`. Biz errors return `Err`. Always handle `Ok`/`Err`.

### AppContainer
DI composition root: `packages/infrastructure/src/container/app-container.ts`

## Existing Docs
- Full architecture, CQRS flow, patterns: `CLAUDE.md`
- API docs (Scalar): http://localhost:3000/docs
- Drizzle schema: `packages/infrastructure/src/database/schema.ts`