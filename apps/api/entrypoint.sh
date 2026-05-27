#!/bin/sh
set -e

# ── Database Migration ──────────────────────────────────────────────────────
# Apply pending migrations using drizzle-orm (programmatic, no drizzle-kit).
echo "▶ Running database migrations..."
bun run /app/migrate-dist/migrate-runner.js

# ── Application Server ──────────────────────────────────────────────────────
echo "▶ Starting API server..."
exec bun run /app/dist/index.js
