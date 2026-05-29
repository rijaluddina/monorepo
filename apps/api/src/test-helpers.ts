/**
 * Test Helpers — Integration test utilities
 *
 * Provides an isolated database instance (custom pg.Pool + drizzle) that
 * bypasses the singleton pool lifecycle issue:
 *
 *   index.test.ts's graceful shutdown test ends the singleton pool from
 *   @repo/infrastructure. Since Bun shares the module cache between test
 *   files in the same process, subsequent files that import the singleton
 *   `db` receive a pool that has already been ended.
 *
 * This helper solves the problem by:
 *   1. Creating a DEDICATED pg.Pool + drizzle() instance per helper call
 *   2. Wrapping processOutbox() so it uses the dedicated db instead of
 *      the singleton (via the optional `customDb` parameter)
 *
 * @see processor.ts — processOutbox accepts optional customDb param
 * @see integration.test.ts — uses this helper
 */

import {
  createAppContainer,
  eventStore,
  outbox,
  processOutbox,
  users,
} from "@repo/infrastructure";
import { type Logger, type err, ok } from "@repo/shared";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { createServer } from "./server";

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Unique email for each test run */
const uniqueEmail = () =>
  `hlp-${Date.now()}-${crypto.randomUUID()}@example.com`;

// ── Custom Db Factory ───────────────────────────────────────────────────────

/**
 * createIsolatedDb — Creates a dedicated pg.Pool + drizzle instance.
 *
 * The caller MUST call pool.end() when done (e.g., in afterAll).
 */
export function createIsolatedDb() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const drizzleSchema = { users, eventStore, outbox };
  const db = drizzle(pool, { schema: drizzleSchema });
  return { pool, db };
}

export type IsolatedDb = ReturnType<typeof createIsolatedDb>;

/** Minimal container shape needed by processOutbox */
interface ContainerWithExternalBus {
  externalEventBus: {
    publish: (event: {
      eventType: string;
      aggregateId: string;
      version: number;
      occurredAt: Date;
    }) => Promise<ReturnType<typeof ok> | ReturnType<typeof err>>;
  };
}

/**
 * processOutboxWithDb — Calls processOutbox with a custom database instance.
 *
 * Accepts any object with an `externalEventBus` — no need to create a full
 * AppContainer. This makes it easy to pass mock buses in tests.
 *
 * @param container - Object with externalEventBus (or full AppContainer)
 * @param customDb - Custom drizzle instance (from createIsolatedDb)
 * @param logger - Optional logger (defaults to console w/ suppression)
 */
export async function processOutboxWithDb(
  container: ContainerWithExternalBus,
  customDb: ReturnType<typeof drizzle>,
  logger?: Logger,
): Promise<void> {
  await processOutbox(
    container as Parameters<typeof processOutbox>[0],
    logger ?? console,
    customDb as Parameters<typeof processOutbox>[2],
  );
}

/**
 * createTestContainer — Creates an AppContainer wired to a custom db.
 *
 * Also returns the Elysia app for making HTTP requests.
 */
export function createTestContainer(db: ReturnType<typeof drizzle>) {
  const container = createAppContainer(
    db as Parameters<typeof createAppContainer>[0],
  );
  const app = createServer(container);
  return { container, app };
}

/**
 * createMockExternalBus — Simple mock external event bus for testing.
 *
 * Creates an object with `{ publish, publishedEvents }` where `publish`
 * is an async function that tracks published events and returns the
 * configured result, and `publishedEvents` is an array of tracked events.
 */
export function createMockExternalBus(
  result: ReturnType<typeof ok> | ReturnType<typeof err> = ok(undefined),
) {
  const publishedEvents: {
    eventType: string;
    aggregateId: string;
    version: number;
    occurredAt: Date;
  }[] = [];
  const publish = async (event: {
    eventType: string;
    aggregateId: string;
    version: number;
    occurredAt: Date;
  }) => {
    publishedEvents.push({ ...event });
    return result;
  };
  return { publish, publishedEvents };
}

// ── Test Utilities ──────────────────────────────────────────────────────────

/**
 * createUserViaApi — Helper to create a user through the HTTP API.
 */
export async function createUserViaApi(
  app: ReturnType<typeof createServer>,
  overrides: Partial<{
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  }> = {},
) {
  const userData = {
    firstName: "Helper",
    lastName: "User",
    email: uniqueEmail(),
    role: "member",
    ...overrides,
  };

  const response = await app.handle(
    new Request("http://localhost/api/v1/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userData),
    }),
  );

  return {
    response,
    body: (await response.json()) as {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      role: string;
      isActive: boolean;
    },
  };
}
