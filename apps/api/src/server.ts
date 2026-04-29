import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import {
  CreateUserCommand,
  GetUserByIdQuery,
  GetUsersQuery,
  type UserDTO,
} from "@repo/application";
import { AppContainer } from "@repo/infrastructure";
import type { Result } from "@repo/shared";
import { Elysia, t } from "elysia";

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

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
            async ({ query }) => {
              const result = await container.queryBus.ask<
                GetUsersQuery,
                Result<PaginatedResponse<UserDTO>>
              >(
                new GetUsersQuery(
                  Number(query.page ?? 1),
                  Number(query.limit ?? 20),
                ),
              );
              return result.unwrap();
            },
            {
              query: t.Object({
                page: t.Optional(t.Numeric({ default: 1 })),
                limit: t.Optional(t.Numeric({ default: 20 })),
              }),
              response: PaginatedUserResponse,
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
                Result<UserDTO>
              >(
                new CreateUserCommand(
                  body.firstName,
                  body.lastName,
                  body.email,
                  body.role,
                ),
              );
              set.status = 201;
              return result.unwrap();
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
              },
              detail: { tags: ["Users"], summary: "Create a new user" },
            },
          )

          // GET /api/users/:id
          .get(
            "/:id",
            async ({ params }) => {
              const result = await container.queryBus.ask<
                GetUserByIdQuery,
                Result<UserDTO>
              >(new GetUserByIdQuery(params.id));
              return result.unwrap();
            },
            {
              params: t.Object({ id: t.String() }),
              response: UserSchema,
              detail: { tags: ["Users"], summary: "Get user by ID" },
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
