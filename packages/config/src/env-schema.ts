import { z } from "zod";

/**
 * Environment variable validation schema.
 *
 * Validates and parses environment variables at startup so any missing/
 * misconfigured values fail fast with clear error messages instead of
 * obscure runtime failures.
 */
export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    PORT: z.coerce.number().int().positive().optional(),
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    REDIS_URL: z.string().min(1).default("redis://localhost:6379"),
    CORS_ORIGIN: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV !== "production") return;

    if (!data.PORT) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "PORT is required in production — set it explicitly (e.g. PORT=3000)",
        path: ["PORT"],
      });
    }

    if (!data.CORS_ORIGIN) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "CORS_ORIGIN is required in production — set it to your frontend URL " +
          "(e.g. https://app.example.com)",
        path: ["CORS_ORIGIN"],
      });
    }

    // Detect localhost or 127.0.0.1 in REDIS_URL for production safety
    if (/localhost|127\.0\.0\.1/.test(data.REDIS_URL)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "REDIS_URL should not use localhost or 127.0.0.1 in production " +
          "(currently using a loopback address)",
        path: ["REDIS_URL"],
      });
    }
  });

/** Inferred type for validated environment variables */
export type Env = z.infer<typeof envSchema>;
