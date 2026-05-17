import type { DomainEvent } from "@repo/domain";
import { isErr } from "@repo/shared";
import { and, eq, isNull, lt, lte, or } from "drizzle-orm";
import type { AppContainer } from "../container/app-container.ts";
import { db } from "../database/drizzle.client.ts";
import { outbox } from "../database/schema.ts";

const MAX_RETRIES = 10;

/**
 * processOutbox — Polls the outbox table and publishes events to the external broker.
 */
export async function processOutbox(container: AppContainer): Promise<void> {
  const externalEventBus = container.externalEventBus;
  const now = new Date();

  // 1. Fetch pending outbox messages that are new or due for retry
  // We exclude messages that have exceeded MAX_RETRIES (Dead Letter Queue behavior)
  const rows = await db
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

  console.log(`[Outbox] 📦 Found ${rows.length} messages to process.`);

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

        console.error(
          `[Outbox] ❌ Failed to publish event ${row.id} (retry #${retryCount}, next at ${nextRetryAt.toISOString()}):`,
          result.error,
        );

        await db
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
      await db.delete(outbox).where(eq(outbox.id, row.id));
    } catch (err) {
      const retryCount = row.retryCount + 1;
      const nextRetryAt = new Date(Date.now() + 60 * 1000); // Wait 1 minute on unexpected crash

      console.error(`[Outbox] 💥 Unexpected error processing ${row.id}:`, err);

      await db
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
 */
export function startOutboxProcessor(
  container: AppContainer,
  intervalMs = 5000,
): void {
  if (isRunning) return;
  isRunning = true;

  console.log(`[Outbox] 🚀 Worker started (polling every ${intervalMs}ms)`);

  const run = async () => {
    if (!isRunning) return;

    currentRun = processOutbox(container);
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
export async function stopOutboxProcessor(): Promise<void> {
  isRunning = false;

  if (timer) {
    clearTimeout(timer);
    timer = null;
  }

  if (currentRun) {
    console.log("[Outbox] ⏳ Waiting for current iteration to finish...");
    await currentRun;
  }

  console.log("[Outbox] 🛑 Worker stopped.");
}
