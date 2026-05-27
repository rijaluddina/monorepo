# Docker Configuration Changelog

Chronological record of Docker configuration changes from the production deployment session.  
This document documents **problem → root cause → fix** for each iteration.

---

## Summary of Changed Files

| File | Changes |
|---|---|
| `docker-compose.yml` | Environment vars, healthcheck, network configuration |
| `.env` | Added `WEB_PORT` for compose variable interpolation |
| `.env.production` | Hostname, CORS, Redis URL, port mapping |
| `.env.example` | Synced with `.env.production` |
| `apps/web/Dockerfile` | Healthcheck removed (moved to compose), `localhost` → `127.0.0.1` |
| `apps/web/nginx.conf` | Multiple iterations — see details below |

---

## Iteration 1: Initial Setup

### Changes
- Added **"Production Deployment with Docker"** section to `README.md`
- Covers: env variables, build & start, manual migration, rolling update, architecture diagram, health checks, troubleshooting, useful commands

### Files
- `README.md`

---

## Iteration 2: Container API Crash Loop

### Problem
Container `api` keeps restarting — `ECONNREFUSED ::1:5432`

### Root Cause
```yaml
# docker-compose.yml — BEFORE
services:
  api:
    environment:
      DATABASE_URL: ${DATABASE_URL:?}   # ← reads from .env
      REDIS_URL: ${REDIS_URL:?}
      CORS_ORIGIN: ${CORS_ORIGIN:?}
    env_file:
      - .env.production                  # ← also defines the same vars
```

Docker Compose performs **variable substitution** `${...}` from the `.env` file (not `.env.production`).  
`.env` contains `DATABASE_URL=localhost:5432`. This value **overrides** `env_file: .env.production`.

Inside the container, `localhost` refers to the container itself (not the `postgres` service) → connection refused.

### Fix
```yaml
# docker-compose.yml — AFTER
services:
  api:
    environment:
      NODE_ENV: production          # only safe config here
      PORT: ${PORT:-3000}
      OUTBOX_INTERVAL: ${OUTBOX_INTERVAL:-5000}
    env_file:
      - .env.production             # DATABASE_URL, REDIS_URL, CORS_ORIGIN from here only
```

**Principle:** The `environment` section is only for minor config that's safe to override. Core config (`DATABASE_URL`, `REDIS_URL`, `CORS_ORIGIN`) comes **only** from `env_file`.

### Files
- `docker-compose.yml`

---

## Iteration 3: Hostname & Format `.env.production`

### Problem
`.env.production` used `192.168.1.67` (host IP) and an incorrect Redis URL format.

### Changes

| Var | Before | After | Reason |
|---|---|---|---|
| `DATABASE_URL` | `...@192.168.1.67:5432/...` | `...@postgres:5432/...` | Docker service name, not host IP |
| `REDIS_URL` | `redis://admin:superadmin@192.168.1.67:6379` | `redis://:superadmin@redis:6379` | Username `admin` is non-standard for Redis; hostname `redis` (Docker service) |
| `CORS_ORIGIN` | `http://localhost:5174` | `http://localhost` | Port 5174 is Vite dev server; production runs via nginx on port 80 |

### Files
- `.env.production`
- `.env.example` (synced)

---

## Iteration 4: Web Healthcheck — IPv6 Issue

### Problem
Container `web` was always `(unhealthy)` even though nginx was running normally.  
`wget` returned 200 from inside the container, but the healthcheck still failed 15 times in a row with `Connection refused`.

### Root Cause
Healthcheck command:
```dockerfile
HEALTHCHECK CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1
```

`wget` resolves `localhost` to **`[::1]` (IPv6 loopback)**.  
Nginx Alpine only listens on **IPv4** (`0.0.0.0:80`) → IPv6 connection refused.

### Fix
Changed `localhost` → `127.0.0.1` (explicit IPv4):
```dockerfile
HEALTHCHECK CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:80/ || exit 1
```

### Files
- `apps/web/Dockerfile`

---

## Iteration 5: Healthcheck Moved to Compose

### Changes
Healthcheck moved from `Dockerfile` to `docker-compose.yml` for better transparency and easier modification without rebuilding the image.

### Files
| File | Before | After |
|---|---|---|
| `apps/web/Dockerfile` | Had `HEALTHCHECK ...` | Removed |
| `docker-compose.yml` | No web healthcheck | `healthcheck: test: ["CMD", "wget", ...]` with identical params |

### Compose Format
```yaml
healthcheck:
  test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://127.0.0.1:80/"]
  interval: 10s
  timeout: 3s
  retries: 3
```

---

## Iteration 6: Port 5173

### Problem
User wanted the web service on port `5173` (instead of `80`).

### Changes
| File | Changes |
|---|---|
| `.env.production` | Added `WEB_PORT=5173`, `CORS_ORIGIN=http://localhost:5173` |
| `.env` | Added `WEB_PORT=5173` |

### Important Note
Docker Compose reads variables for **compose file interpolation** (`${WEB_PORT:-80}`) from **`.env`**, not from `env_file`.  
So even though `WEB_PORT` exists in `.env.production`, compose still needs to read it from `.env`.

```
.env                          → used for ${WEB_PORT:-80} in docker-compose.yml
.env.production (env_file)    → passed to container as environment variables
```

---

## Iteration 7: Nginx Proxy — 4 Sub-iterations

### 7a — "host not found in upstream"

**Problem:** Nginx crashed at startup — `host not found in upstream "api"`

**Root Cause:** Nginx resolves the `api` hostname during config load, but the `api` container wasn't ready to accept connections yet.

**Fix:** Added `resolver 127.0.0.11` + `proxy_pass` with a variable (forces runtime DNS resolution):
```nginx
resolver 127.0.0.11 ipv6=off valid=10s;
location /api/ {
    set $backend "http://api:3000";
    proxy_pass $backend;
}
```

---

### 7b — "uninitialized backend variable" (500 error)

**Problem:** Nginx returned `500 Internal Server Error`.  
Log: `using uninitialized "backend" variable` and `invalid URL prefix in ""`.

**Root Cause:** The combination of `rewrite ... break` + `proxy_pass $backend` (variable) caused nginx to not execute `set $backend` before `proxy_pass`. This is a nginx bug/limitation in certain Alpine versions.

**Fix:** Replaced rewrite + set variable with a regex location:
```nginx
location ~ ^/api/(.*) {
    proxy_pass http://api:3000/$1;
    ...
}
```

---

### 7c — API path mismatch (404)

**Problem:** `/api/v1/users` returned 404 via nginx.

**Root Cause:** Regex location `~ ^/api/(.*)` captures `$1 = v1/users`, `proxy_pass http://api:3000/$1` sends `GET /v1/users` to the API. But API routes are under the `/api/v1/` prefix:
```typescript
// server.ts
.group("/api/v1", (app) => app.use(userRoutes(container)))
// → Route: GET /api/v1/users
```

So the API expects `/api/v1/users`, not `/v1/users`.

**Fix:** Replaced the regex location (which strips the prefix) with a prefix location **passthrough**:
```nginx
location /api/ {
    proxy_pass http://api:3000$request_uri;
    ...
}
```

`$request_uri` is the **original request URI** (including `/api/v1/users`). It's forwarded as-is to the API → matches the expected route.

---

### Nginx Config Evolution Summary

| Iteration | Config | Issue |
|---|---|---|
| Original | `proxy_pass http://api:3000;` | Crashes at startup (host not found) |
| 7a | `set $backend` + `proxy_pass $backend` | ✅ Runtime DNS, but needs prefix stripping |
| 7b | `rewrite ... break` + `proxy_pass $backend` | ❌ Uninitialized variable (500) |
| 7b v2 | `location ~ ^/api/(.*)` + `proxy_pass .../$1` | ❌ Path mismatch (404) — strips too much |
| **7c** | **`location /api/` + `proxy_pass ...$request_uri`** | ✅ **Final — correct** |

---

## Final State: Container Topology

```
Browser ──> :5173 ──> nginx ──> /api/* ──> api:3000/api/v1/* (ElysiaJS)
                         │
                         └──> index.html (React SPA)

api:3000 ──> postgres:5432
        ──> redis:6379
```

### Port Mapping

| Service | Container Port | Host Port | Env Variable |
|---|---|---|---|
| `postgres` | 5432 | — | — |
| `redis` | 6379 | — | — |
| `api` | 3000 | 3000 (default) | `API_PORT` |
| `web` | 80 | 5173 | `WEB_PORT` |

### Env File Strategy

| File | Used For | Variable Substitution |
|---|---|---|
| `.env` | Local development + **compose variable interpolation** | `${WEB_PORT:-80}` |
| `.env.production` | Container environment (via `env_file`) | `DATABASE_URL`, `REDIS_URL`, `CORS_ORIGIN` |
