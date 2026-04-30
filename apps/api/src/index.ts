import { createServer } from "./server.ts";

const PORT = Number(process.env.PORT ?? 3000);

const app = createServer();

app.listen(PORT, () => {
  console.log(`
  ┌─────────────────────────────────────────────┐
  │                                             │
  │   🚀 Monorepo API running                   │
  │                                             │
  │   HTTP  →  http://localhost:${PORT}         │
  │   Docs  →  http://localhost:${PORT}/docs    │
  │                                             │
  └─────────────────────────────────────────────┘
  `);
});

export type { App } from "./server.ts";
