import {
  createAppContainer,
  pool,
  startOutboxProcessor,
  stopOutboxProcessor,
} from "@repo/infrastructure";
import { z } from "zod";
import { createServer, getCorsOrigin } from "./server.ts";

// ── Environment validation ──────────────────────────────────────────────────
// Validated early at startup so any missing/misconfigured env vars fail fast
// with clear error messages instead of obscure runtime failures.

const envSchema = z
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

    if (data.REDIS_URL === "redis://localhost:6379") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "REDIS_URL should be explicitly set in production " +
          "(currently using localhost default)",
        path: ["REDIS_URL"],
      });
    }
  });

const envResult = envSchema.safeParse(process.env);

if (!envResult.success) {
  console.error("\n❌ Invalid environment variables:");
  for (const issue of envResult.error.issues) {
    console.error(`   \u2022 ${issue.path.join(".")}: ${issue.message}`);
  }
  console.error();
  process.exit(1);
}

const env = envResult.data;

// ── Startup banner helpers ──────────────────────────────────────────────────

const corsOrigin = getCorsOrigin();
const corsOriginString =
  typeof corsOrigin === "string"
    ? corsOrigin
    : corsOrigin instanceof RegExp
      ? corsOrigin.toString()
      : JSON.stringify(corsOrigin);

const port = env.PORT ?? 3000;

// ── Bootstrap ───────────────────────────────────────────────────────────────

const container = createAppContainer();
const app = createServer(container);

// 🚀 Start background workers
startOutboxProcessor(container, Number(process.env.OUTBOX_INTERVAL ?? 5000));

app.listen(port, () => {
  console.log(`
  ┌─────────────────────────────────────────────┐
  │                                             │
  │   \uD83D\uDE80 Monorepo API running                   │
  │                                             │
  │   HTTP    \u2192  http://localhost:${port}          │
  │   Docs    \u2192  http://localhost:${port}/docs     │
  │   CORS    \u2192  ${corsOriginString.padEnd(32)}│
  │   NODE_ENV \u2192 ${env.NODE_ENV.padEnd(32)}│
  │                                             │
  └─────────────────────────────────────────────┘
`);
});

// ─── Graceful Shutdown ───────────────────────────────────────────────────────

const shutdown = async (signal: string) => {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  await stopOutboxProcessor();
  await container.disconnect();
  await pool.end();
  console.log("Database pool closed. Exiting.");
  process.exit(0);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

export type { App } from "./server.ts";
