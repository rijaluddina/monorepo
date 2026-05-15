import {
  createAppContainer,
  pool,
  startOutboxProcessor,
  stopOutboxProcessor,
} from "@repo/infrastructure";
import { createServer } from "./server.ts";

const PORT = Number(process.env.PORT ?? 3000);

const container = createAppContainer();
const app = createServer(container);

// 🚀 Start background workers
startOutboxProcessor(container, Number(process.env.OUTBOX_INTERVAL ?? 5000));

app.listen(PORT, () => {
  console.log(`
  ┌─────────────────────────────────────────────┐
  │                                             │
  │   🚀 Monorepo API running                   │
  │                                             │
  │   HTTP  →  http://localhost:${PORT}            │
  │   Docs  →  http://localhost:${PORT}/docs       │
  │                                             │
  └─────────────────────────────────────────────┘
`);
});

// ─── Graceful Shutdown ───────────────────────────────────────────────────────

const shutdown = async (signal: string) => {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  stopOutboxProcessor();
  await pool.end();
  console.log("Database pool closed. Exiting.");
  process.exit(0);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

export type { App } from "./server.ts";
