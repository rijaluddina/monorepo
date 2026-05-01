import { pool } from "@repo/infrastructure";
import { createServer } from "./server.ts";

const PORT = Number(process.env.PORT ?? 3000);

const app = createServer();

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
  await pool.end();
  console.log("Database pool closed. Exiting.");
  process.exit(0);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

export type { App } from "./server.ts";
