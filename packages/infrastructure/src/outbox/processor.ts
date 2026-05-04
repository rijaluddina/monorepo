import type { DomainEvent } from "@repo/domain";
import { eq } from "drizzle-orm";
import { AppContainer } from "../container/app-container.ts";
import { db } from "../database/drizzle.client.ts";
import { outbox } from "../database/schema.ts";

const eventBus = AppContainer.getInstance().eventBus;

export async function processOutbox(): Promise<void> {
  const rows = await db.select().from(outbox).limit(100);

  for (const row of rows) {
    try {
      const eventData = row.payload as Record<string, unknown>;
      const event: DomainEvent = {
        aggregateId: row.aggregateId,
        eventType: row.eventType,
        occurredAt: row.createdAt,
        version: (eventData.version as number) ?? 1,
      };
      await eventBus.publish(event);
      await db.delete(outbox).where(eq(outbox.id, row.id));
    } catch {
      // keep row for retry
    }
  }
}
