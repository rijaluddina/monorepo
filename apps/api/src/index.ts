import { envSchema } from "@repo/config";
import { createServer, getCorsOrigin } from "./server.ts";

// ── Environment validation ──────────────────────────────────────────────────
// ⚠️ Validated BEFORE importing @repo/infrastructure so that if DATABASE_URL
// or other required env vars are missing, we get a clear error message instead
// of an obscure throw from drizzle.client.ts.

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

// ── Dynamically import infrastructure AFTER env validation passes ─────────
// Static import of @repo/infrastructure would eagerly load drizzle.client.ts
// which throws if DATABASE_URL is missing. By deferring to a dynamic import,
// we guarantee envSchema fails first with a helpful message.

const { createAppContainer, PinoLogger, startOutboxProcessor } = await import(
  "@repo/infrastructure"
);

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

const logger = new PinoLogger();
const container = createAppContainer(undefined, logger);
const app = createServer(container, logger);

// 🚀 Start background workers
startOutboxProcessor(
  container,
  Number(process.env.OUTBOX_INTERVAL ?? 5000),
  logger,
);

app.listen(port, () => {
  // Register HTTP server for cleanup — stop accepting new connections
  // FIRST during shutdown, before internal resources are torn down.
  container.registerDisposable({
    disconnect: async () => {
      await app.server?.stop();
    },
  });

  logger.info("🚀 Monorepo running");
});

// ─── Graceful Shutdown ───────────────────────────────────────────────────────
// container.disconnect() handles all cleanup in order:
//   1. HTTP server stops (accept no new connections)
//   2. Outbox processor stops (no new publishes)
//   3. Redis event bus disconnects
//   4. Database pool closes

const shutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  const result = await container.disconnect();
  if (result.errors.length > 0) {
    logger.error("Shutdown completed with errors:");
    for (const err of result.errors) {
      logger.error(`  • ${err.message}`);
    }
  } else {
    logger.info("Cleanup complete. Exiting.");
  }
  process.exit(0);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

export type { App } from "./server.ts";
