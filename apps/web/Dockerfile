# ── Build stage ────────────────────────────────────────────────────────────
# Build the Vite React app with all workspace dependencies.
FROM oven/bun:1.3-alpine AS builder

ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

WORKDIR /app

# Copy workspace root config
COPY package.json bun.lock turbo.json ./

# Copy web app
COPY apps/web ./apps/web

# Copy workspace packages required by the web app
COPY packages/ui              ./packages/ui
COPY packages/shared          ./packages/shared
COPY packages/typescript-config ./packages/typescript-config

# Eden treaty types (@repo/api) and UserDTO (@repo/shared) are still needed as workspace deps.
# @repo/application remains because @repo/api depends on it transitively.
COPY apps/api                  ./apps/api
COPY packages/application      ./packages/application
COPY packages/config           ./packages/config
COPY packages/domain           ./packages/domain
COPY packages/infrastructure   ./packages/infrastructure

# Install all dependencies
# Note: no --frozen-lockfile because the lockfile may have local-only changes.
RUN bun install

# Build the Vite app
RUN cd apps/web && bun run build

# ── Production stage (nginx) ────────────────────────────────────────────────
FROM nginx:1.27-alpine AS production

# Copy nginx config
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built static assets
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80


CMD ["nginx", "-g", "daemon off;"]
