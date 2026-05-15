import type { DomainEvent } from "@repo/domain";
import { isErr } from "@repo/shared";
import { eq } from "drizzle-orm";
import type { AppContainer } from "../container/app-container.ts";
import { db } from "../database/drizzle.client.ts";
import { outbox } from "../database/schema.ts";

/**
 * processOutbox — Polls the outbox table and publishes events to the external broker.
 */
export async function processOutbox(container: AppContainer): Promise<void> {
  const externalEventBus = container.externalEventBus;
  // 1. Fetch pending outbox messages
  const rows = await db.select().from(outbox).limit(50);

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
        console.error(
          `[Outbox] ❌ Failed to publish event ${row.id}:`,
          result.error,
        );
        continue;
      }

      // 3. Delete from outbox on success
      await db.delete(outbox).where(eq(outbox.id, row.id));
    } catch (err) {
      console.error(`[Outbox] 💥 Unexpected error processing ${row.id}:`, err);
    }
  }
}

let isRunning = false;
let timer: ReturnType<typeof setTimeout> | null = null;

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
    await processOutbox(container);
    if (isRunning) {
      timer = setTimeout(run, intervalMs);
    }
  };

  run();
}

/**
 * stopOutboxProcessor — Gracefully stops the outbox polling worker.
 */
export function stopOutboxProcessor(): void {
  isRunning = false;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  console.log("[Outbox] 🛑 Worker stopped.");
}
