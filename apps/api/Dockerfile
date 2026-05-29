# ── Build stage ────────────────────────────────────────────────────────────
# Install all dependencies and bundle both API and migration runner.
FROM oven/bun:1.3-alpine AS builder

WORKDIR /app

# Copy workspace root config
COPY package.json bun.lock turbo.json ./

# Copy API app
COPY apps/api ./apps/api

# Copy workspace packages required by the API
COPY packages/config        ./packages/config
COPY packages/domain        ./packages/domain
COPY packages/shared        ./packages/shared
COPY packages/application   ./packages/application
COPY packages/infrastructure ./packages/infrastructure
COPY packages/typescript-config ./packages/typescript-config

# Install all dependencies (devDeps needed for build)
# Note: no --frozen-lockfile because the lockfile may include local-only changes
# (e.g. zod was added during development). The build context is self-contained.
RUN bun install

# Bundle the API into a single file
RUN cd apps/api && bun run build

# Bundle the migration runner into a single file (uses drizzle-orm, not drizzle-kit)
RUN cd packages/infrastructure && bun build src/database/migrate-runner.ts --outdir /app/migrate-dist --target bun

# ── Production stage ───────────────────────────────────────────────────────
# Minimal runtime image — only the bundles + migration files + Bun runtime.
FROM oven/bun:1.3-alpine AS production

WORKDIR /app

# Copy migration SQL files (needed by drizzle-orm migrator at runtime)
COPY --from=builder /app/packages/infrastructure/drizzle ./drizzle

# Copy migration runner bundle
COPY --from=builder /app/migrate-dist ./migrate-dist

# Copy API bundle
COPY --from=builder /app/apps/api/dist ./dist

# Copy entrypoint script
COPY apps/api/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

ENTRYPOINT ["./entrypoint.sh"]
