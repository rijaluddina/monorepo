import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import type { AppContainer } from "@repo/infrastructure";
import type { Logger } from "@repo/shared";
import { Elysia } from "elysia";
import { healthRoutes } from "./routes/health.routes";
import { userRoutes } from "./routes/user.routes";

export interface AppErrorShape {
  statusCode?: number;
  status?: number;
  code?: string;
  message: string;
}

/**
 * Global error handler used by createServer().
 *
 * Exported separately so integration tests can verify structured logging
 * (PinoLogger → {err} serialization) without needing a running Elysia
 * instance or database.
 */
export function handleServerError(
  logger: Logger,
  error: unknown,
  set: { status?: number | string },
): { error: { code: string; message: string } } {
  const msg = "API Error Captured:";
  logger.error(msg, error);

  const appError = error as AppErrorShape;
  const status = appError.statusCode ?? appError.status ?? 500;
  set.status = status;

  return {
    error: {
      code: appError.code ?? "INTERNAL_ERROR",
      message: status === 500 ? "Internal server error" : appError.message,
    },
  };
}

/**
 * Resolves CORS origin from environment variable with sensible fallback.
 *
 * CORS_ORIGIN supports three formats:
 *   - Not set / empty → regex for localhost:port (safe for local dev)
 *   - Regex pattern  → /^https:\/\/app\.example\.com$/ (starts with ^)
 *   - Comma-separated → http://localhost:5173,https://app.example.com
 *
 * Examples:
 *   CORS_ORIGIN="^https?:\/\/localhost:\d{4,5}$"   ← regex (local dev)
 *   CORS_ORIGIN="https://app.example.com"            ← single origin
 *   CORS_ORIGIN="http://localhost:5173,https://app.example.com"  ← multiple
 */
function getCorsOrigin(): string | RegExp | Array<string | RegExp> {
  const envOrigin = process.env.CORS_ORIGIN;

  if (!envOrigin) {
    // Default: allow all localhost ports (safe for local dev)
    return /^https?:\/\/localhost:\d{4,5}$/;
  }

  // Regex pattern (starts with ^)
  if (envOrigin.startsWith("^")) {
    return new RegExp(envOrigin);
  }

  // Comma-separated list of origins
  const origins = envOrigin
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return origins.length === 1 ? (origins[0] as string) : origins;
}

/**
 * createServer — builds and returns the Elysia app instance.
 *
 * Presentation layer only: maps HTTP ↔ CQRS bus.
 * No business logic lives here — everything delegated via buses.
 */
// Export for use in startup logs / production guard in index.ts
export { getCorsOrigin };

export function createServer(
  container: AppContainer,
  logger: Logger = console,
) {
  const app = new Elysia()
    // ── Global plugins ──────────────────────────────────────────────────
    .use(
      cors({
        origin: getCorsOrigin(),
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      }),
    )
    .use(
      swagger({
        documentation: {
          info: {
            title: "Monorepo API",
            version: "1.0.0",
            description:
              "ElysiaJS API — Clean Architecture, DDD, CQRS, Event Sourcing",
          },
        },
        path: "/docs",
      }),
    )

    // ── Routes ──────────────────────────────────────────────────────────
    .get("/", () => ({
      message: "Monorepo API is running",
      documentation: "/docs",
      health: "/health",
    }))
    .get("/favicon.ico", () => {
      return new Response(null, { status: 204 });
    })
    .use(healthRoutes)
    .group("/api/v1", (app) => app.use(userRoutes(container)))

    // ── Global error handler ────────────────────────────────────────────
    .onError(({ error, set }) => handleServerError(logger, error, set));

  return app;
}

export type App = ReturnType<typeof createServer>;
