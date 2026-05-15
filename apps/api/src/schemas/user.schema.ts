import { t } from "elysia";

export const UserSchema = t.Object(
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

export const PaginatedUserResponse = t.Object(
  {
    data: t.Array(UserSchema),
    total: t.Number(),
    page: t.Number(),
    limit: t.Number(),
    totalPages: t.Number(),
  },
  { description: "Paginated user list response" },
);
