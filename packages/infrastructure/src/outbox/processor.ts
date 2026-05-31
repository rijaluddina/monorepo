import type { DomainEvent } from "@repo/domain";
import { type Logger, isErr } from "@repo/shared";
import { and, eq, isNull, lt, lte, or } from "drizzle-orm";
import type { AppContainer } from "../container/app-container.ts";
import { db as defaultDb } from "../database/drizzle.client.ts";
import type { DrizzleDB } from "../database/drizzle.client.ts";
import { outbox } from "../database/schema.ts";

const MAX_RETRIES = 10;

/**
 * processOutbox — Polls the outbox table and publishes events to the external broker.
 *
 * @param container - AppContainer with externalEventBus
 * @param logger - Logger instance
 * @param customDb - Optional custom database instance.
 *   Used by integration tests to provide an isolated pool that
 *   won't be affected by the singleton pool's lifecycle.
 *   Falls back to the default singleton db when omitted.
 */
export async function processOutbox(
  container: AppContainer,
  logger: Logger = console,
  customDb?: DrizzleDB,
): Promise<void> {
  const externalEventBus = container.externalEventBus;
  const theDb = customDb ?? defaultDb;
  const now = new Date();

  // 1. Fetch pending outbox messages that are new or due for retry
  // We exclude messages that have exceeded MAX_RETRIES (Dead Letter Queue behavior)
  const rows = await theDb
    .select()
    .from(outbox)
    .where(
      and(
        or(isNull(outbox.nextRetryAt), lte(outbox.nextRetryAt, now)),
        lt(outbox.retryCount, MAX_RETRIES),
      ),
    )
    .limit(50);

  if (rows.length === 0) return;

  logger.info(`[Outbox] Found ${rows.length} messages to process.`);
  for (const row of rows) {
    try {
      const eventData = row.payload as Record<string, unknown>;
      const event: DomainEvent = {
        ...eventData,
        aggregateId: row.aggregateId,
        eventType: row.eventType,
        occurredAt: row.createdAt,
        version: (eventData.version as number) ?? 1,
      } as DomainEvent;

      // 2. Publish to external broker
      const result = await externalEventBus.publish(event);

      if (isErr(result)) {
        const retryCount = row.retryCount + 1;
        // Exponential backoff: 2^retryCount * 5 seconds (max 1024 * 5 = ~1.4h)
        const delaySeconds = 2 ** Math.min(retryCount, 10) * 5;
        const nextRetryAt = new Date(Date.now() + delaySeconds * 1000);

        logger.error(
          `[Outbox] Failed to publish event ${row.id} (retry #${retryCount}, next at ${nextRetryAt.toISOString()}):`,
          result.error,
        );

        await theDb
          .update(outbox)
          .set({
            retryCount,
            lastError: result.error.message,
            nextRetryAt,
          })
          .where(eq(outbox.id, row.id));
        continue;
      }

      // 3. Delete from outbox on success
      await theDb.delete(outbox).where(eq(outbox.id, row.id));
    } catch (err) {
      const retryCount = row.retryCount + 1;
      const nextRetryAt = new Date(Date.now() + 60 * 1000); // Wait 1 minute on unexpected crash

      logger.error(`[Outbox] Unexpected error processing ${row.id}:`, err);

      await theDb
        .update(outbox)
        .set({
          retryCount,
          lastError: err instanceof Error ? err.message : String(err),
          nextRetryAt,
        })
        .where(eq(outbox.id, row.id));
    }
  }
}

let isRunning = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let currentRun: Promise<void> | null = null;

/**
 * startOutboxProcessor — Starts the outbox polling worker.
 *
 * @param container - AppContainer with externalEventBus
 * @param intervalMs - Polling interval in milliseconds (default: 5000)
 * @param logger - Logger instance
 * @param customDb - Optional custom database instance.
 *   Passed through to processOutbox for test isolation.
 */
export function startOutboxProcessor(
  container: AppContainer,
  intervalMs = Number(process.env.OUTBOX_INTERVAL ?? 5000),
  logger: Logger = console,
  customDb?: DrizzleDB,
): void {
  if (isRunning) return;
  isRunning = true;

  logger.info(`[Outbox] Worker started (polling every ${intervalMs}ms)`);

  const run = async () => {
    if (!isRunning) return;

    currentRun = processOutbox(container, logger, customDb);
    try {
      await currentRun;
    } finally {
      currentRun = null;
    }

    if (isRunning) {
      timer = setTimeout(run, intervalMs);
    }
  };

  run();
}

/**
 * stopOutboxProcessor — Gracefully stops the outbox polling worker.
 * Waits for the current iteration to complete before returning.
 */
export async function stopOutboxProcessor(
  logger: Logger = console,
): Promise<void> {
  isRunning = false;

  if (timer) {
    clearTimeout(timer);
    timer = null;
  }

  if (currentRun) {
    logger.info("[Outbox] Waiting for current iteration to finish...");
    await currentRun;
  }

  logger.info("[Outbox] Worker stopped.");
}
