import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { AppContainer } from "@repo/infrastructure";
import { CreateUserCommand, GetUsersQuery, GetUserByIdQuery } from "@repo/application";

/**
 * createServer — builds and returns the Elysia app instance.
 *
 * Presentation layer only: maps HTTP ↔ CQRS bus.
 * No business logic lives here — everything delegated via buses.
 */
export function createServer() {
  const container = AppContainer.getInstance();

  const app = new Elysia()
    // ── Global plugins ──────────────────────────────────────────────────
    .use(
      cors({
        origin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      }),
    )
    .use(
      swagger({
        documentation: {
          info: {
            title: "Monorepo API",
            version: "1.0.0",
            description: "ElysiaJS API — Clean Architecture, DDD, CQRS, Event Sourcing",
          },
        },
        path: "/docs",
      }),
    )

    // ── Health ──────────────────────────────────────────────────────────
    .get(
      "/health",
      () => ({ status: "ok", timestamp: new Date().toISOString() }),
      {
        detail: { tags: ["Health"], summary: "Health check" },
      },
    )

    // ── Users ───────────────────────────────────────────────────────────
    .group("/api/users", (app) =>
      app
        // GET /api/users?page=1&limit=20
        .get(
          "/",
          async ({ query }) => {
            return await container.queryBus.ask(
              new GetUsersQuery(Number(query.page ?? 1), Number(query.limit ?? 20)),
            );
          },
          {
            query: t.Object({
              page: t.Optional(t.String()),
              limit: t.Optional(t.String()),
            }),
            detail: { tags: ["Users"], summary: "List all users (paginated)" },
          },
        )

        // GET /api/users/:id
        .get(
          "/:id",
          async ({ params }) => {
            return await container.queryBus.ask(new GetUserByIdQuery(params.id));
          },
          {
            params: t.Object({ id: t.String() }),
            detail: { tags: ["Users"], summary: "Get user by ID" },
          },
        )

        // POST /api/users
        .post(
          "/",
          async ({ body, set }) => {
            const user = await container.commandBus.dispatch(
              new CreateUserCommand(body.firstName, body.lastName, body.email, body.role),
            );
            set.status = 201;
            return user;
          },
          {
            body: t.Object({
              firstName: t.String({ minLength: 1 }),
              lastName: t.String({ minLength: 1 }),
              email: t.String({ format: "email" }),
              role: t.Optional(t.Union([t.Literal("admin"), t.Literal("member"), t.Literal("viewer")])),
            }),
            detail: { tags: ["Users"], summary: "Create a new user" },
          },
        ),
    )

    // ── Global error handler ────────────────────────────────────────────
    .onError(({ error, set }) => {
      const appError = error as { statusCode?: number; code?: string; message: string };
      const status = appError.statusCode ?? 500;
      set.status = status;
      return {
        error: {
          code: appError.code ?? "INTERNAL_ERROR",
          message: appError.message,
          status,
        },
      };
    });

  return app;
}

export type App = ReturnType<typeof createServer>;
