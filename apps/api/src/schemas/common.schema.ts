import { t } from "elysia";

export const ErrorSchema = t.Object({
  error: t.Object({
    code: t.String(),
    message: t.String(),
  }),
});

export const ValidationErrorSchema = t.Object({
  type: t.Optional(t.String()),
  on: t.Optional(t.String()),
  summary: t.Optional(t.String()),
  property: t.Optional(t.String()),
  message: t.String(),
  expected: t.Optional(t.Unknown()),
  found: t.Optional(t.Unknown()),
  errors: t.Optional(t.Array(t.Unknown())),
});
