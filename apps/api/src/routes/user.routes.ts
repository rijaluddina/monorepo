import {
  ActivateUserCommand,
  ChangeUserEmailCommand,
  ChangeUserRoleCommand,
  CreateUserCommand,
  DeactivateUserCommand,
  DeleteUserCommand,
  GetUserByIdQuery,
  GetUsersQuery,
  type UserDTO,
} from "@repo/application";
import type { AppContainer } from "@repo/infrastructure";
import type { PaginatedResult } from "@repo/shared";
import { Elysia, t } from "elysia";
import { ErrorSchema, ValidationErrorSchema } from "../schemas/common.schema";
import { PaginatedUserResponse, UserSchema } from "../schemas/user.schema";

export const userRoutes = (container: AppContainer) =>
  new Elysia().group("/users", (app) =>
    app
      // GET /
      .get(
        "/",
        async ({ query, set }) => {
          const result = await container.queryBus.ask<
            GetUsersQuery,
            PaginatedResult<UserDTO>
          >(
            new GetUsersQuery(
              Number(query.page),
              Number(query.limit),
              query.search,
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
            search: t.Optional(t.String()),
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

      // POST /
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
            422: ValidationErrorSchema,
            500: ErrorSchema,
          },
          detail: { tags: ["Users"], summary: "Create a new user" },
        },
      )

      // GET /:id
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

      // PATCH /:id/activate
      .patch(
        "/:id/activate",
        async ({ params, set }) => {
          const result = await container.commandBus.dispatch<
            ActivateUserCommand,
            void
          >(new ActivateUserCommand(params.id));

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
            500: ErrorSchema,
          },
          detail: { tags: ["Users"], summary: "Activate a user" },
        },
      )

      // PATCH /:id/deactivate
      .patch(
        "/:id/deactivate",
        async ({ params, set }) => {
          const result = await container.commandBus.dispatch<
            DeactivateUserCommand,
            void
          >(new DeactivateUserCommand(params.id));

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
            500: ErrorSchema,
          },
          detail: { tags: ["Users"], summary: "Deactivate a user" },
        },
      )

      // PATCH /:id/email
      .patch(
        "/:id/email",
        async ({ params, body, set }) => {
          const result = await container.commandBus.dispatch<
            ChangeUserEmailCommand,
            void
          >(new ChangeUserEmailCommand(params.id, body.email));

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
          body: t.Object({ email: t.String({ format: "email" }) }),
          response: {
            204: t.Void(),
            400: ErrorSchema,
            404: ErrorSchema,
            409: ErrorSchema,
            500: ErrorSchema,
          },
          detail: { tags: ["Users"], summary: "Change user email" },
        },
      )

      // PATCH /:id/role
      .patch(
        "/:id/role",
        async ({ params, body, set }) => {
          const result = await container.commandBus.dispatch<
            ChangeUserRoleCommand,
            void
          >(new ChangeUserRoleCommand(params.id, body.role));

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
          body: t.Object({
            role: t.Union([
              t.Literal("admin"),
              t.Literal("member"),
              t.Literal("viewer"),
            ]),
          }),
          response: {
            204: t.Void(),
            400: ErrorSchema,
            404: ErrorSchema,
            500: ErrorSchema,
          },
          detail: { tags: ["Users"], summary: "Change user role" },
        },
      )

      // DELETE /:id
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
  );
