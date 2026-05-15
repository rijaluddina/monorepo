import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import type { AppContainer } from "@repo/infrastructure";
import { Elysia } from "elysia";
import { healthRoutes } from "./routes/health.routes";
import { userRoutes } from "./routes/user.routes";

/**
 * createServer — builds and returns the Elysia app instance.
 *
 * Presentation layer only: maps HTTP ↔ CQRS bus.
 * No business logic lives here — everything delegated via buses.
 */
export function createServer(container: AppContainer) {
  const app = new Elysia()
    // ── Global plugins ──────────────────────────────────────────────────
    .use(
      cors({
        origin: [
          "http://localhost:5173",
          "http://localhost:5174",
          "http://localhost:5175",
        ],
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
    .onError(({ error, set }) => {
      console.error("API Error Captured:", error);
      const appError = error as {
        statusCode?: number;
        status?: number;
        code?: string;
        message: string;
      };
      const status = appError.statusCode ?? appError.status ?? 500;
      set.status = status;
      return {
        error: {
          code: appError.code ?? "INTERNAL_ERROR",
          message: status === 500 ? "Internal server error" : appError.message,
        },
      };
    });

  return app;
}

export type App = ReturnType<typeof createServer>;
