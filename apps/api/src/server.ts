import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import {
  CreateUserCommand,
  DeleteUserCommand,
  GetUserByIdQuery,
  GetUsersQuery,
  type UserDTO,
} from "@repo/application";
import { AppContainer } from "@repo/infrastructure";
import type { PaginatedResult } from "@repo/shared";
import { Elysia, t } from "elysia";

const UserSchema = t.Object(
  {
    id: t.String(),
    firstName: t.String(),
    lastName: t.String(),
    fullName: t.String(),
    email: t.String({ format: "email" }),
    role: t.Union([
      t.Literal("admin"),
      t.Literal("member"),
      t.Literal("viewer"),
    ]),
    isActive: t.Boolean(),
    createdAt: t.String({ format: "date-time" }),
    updatedAt: t.String({ format: "date-time" }),
  },
  { description: "User data" },
);

const PaginatedUserResponse = t.Object(
  {
    data: t.Array(UserSchema),
    total: t.Number(),
    page: t.Number(),
    limit: t.Number(),
    totalPages: t.Number(),
  },
  { description: "Paginated user list response" },
);

const ErrorSchema = t.Object({
  error: t.Object({
    code: t.String(),
    message: t.String(),
  }),
});

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
            description:
              "ElysiaJS API — Clean Architecture, DDD, CQRS, Event Sourcing",
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

    // ── API ─────────────────────────────────────────────────────────────
    .group("/api", (app) =>
      app.group("/users", (app) =>
        app
          // GET /api/users
          .get(
            "/",
            async ({ query, set }) => {
              const result = await container.queryBus.ask<
                GetUsersQuery,
                PaginatedResult<UserDTO>
              >(
                new GetUsersQuery(
                  Number(query.page ?? 1),
                  Number(query.limit ?? 20),
                ),
              );

              if (result.isErr()) {
                set.status = result.error.statusCode ?? 500;
                return {
                  error: {
                    code: result.error.code,
                    message: result.error.message,
                  },
                };
              }

              return result.value;
            },
            {
              query: t.Object({
                page: t.Optional(t.Numeric({ default: 1 })),
                limit: t.Optional(t.Numeric({ default: 20 })),
              }),
              response: {
                200: PaginatedUserResponse,
                400: ErrorSchema,
                404: ErrorSchema,
                409: ErrorSchema,
                500: ErrorSchema,
              },
              detail: {
                tags: ["Users"],
                summary: "List all users (paginated)",
              },
            },
          )

          // POST /api/users
          .post(
            "/",
            async ({ body, set }) => {
              const result = await container.commandBus.dispatch<
                CreateUserCommand,
                UserDTO
              >(
                new CreateUserCommand(
                  body.firstName,
                  body.lastName,
                  body.email,
                  body.role,
                ),
              );

              if (result.isErr()) {
                set.status = result.error.statusCode ?? 500;
                return {
                  error: {
                    code: result.error.code,
                    message: result.error.message,
                  },
                };
              }

              set.status = 201;
              return result.value;
            },
            {
              body: t.Object({
                firstName: t.String({ minLength: 1 }),
                lastName: t.String({ minLength: 1 }),
                email: t.String({ format: "email" }),
                role: t.Optional(
                  t.Union([
                    t.Literal("admin"),
                    t.Literal("member"),
                    t.Literal("viewer"),
                  ]),
                ),
              }),
              response: {
                201: UserSchema,
                400: ErrorSchema,
                404: ErrorSchema,
                409: ErrorSchema,
                500: ErrorSchema,
              },
              detail: { tags: ["Users"], summary: "Create a new user" },
            },
          )

          // GET /api/users/:id
          .get(
            "/:id",
            async ({ params, set }) => {
              const result = await container.queryBus.ask<
                GetUserByIdQuery,
                UserDTO
              >(new GetUserByIdQuery(params.id));

              if (result.isErr()) {
                set.status = result.error.statusCode ?? 500;
                return {
                  error: {
                    code: result.error.code,
                    message: result.error.message,
                  },
                };
              }

              return result.value;
            },
            {
              params: t.Object({ id: t.String() }),
              response: {
                200: UserSchema,
                400: ErrorSchema,
                404: ErrorSchema,
                409: ErrorSchema,
                500: ErrorSchema,
              },
              detail: { tags: ["Users"], summary: "Get user by ID" },
            },
          )

          // DELETE /api/users/:id
          .delete(
            "/:id",
            async ({ params, set }) => {
              const result = await container.commandBus.dispatch<
                DeleteUserCommand,
                void
              >(new DeleteUserCommand(params.id));

              if (result.isErr()) {
                set.status = result.error.statusCode ?? 500;
                return {
                  error: {
                    code: result.error.code,
                    message: result.error.message,
                  },
                };
              }

              set.status = 204;
              return;
            },
            {
              params: t.Object({ id: t.String() }),
              response: {
                204: t.Void(),
                400: ErrorSchema,
                404: ErrorSchema,
                409: ErrorSchema,
                500: ErrorSchema,
              },
              detail: { tags: ["Users"], summary: "Delete a user" },
            },
          ),
      ),
    )

    // ── Global error handler ────────────────────────────────────────────
    .onError(({ error, set }) => {
      const appError = error as {
        statusCode?: number;
        code?: string;
        message: string;
      };
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
