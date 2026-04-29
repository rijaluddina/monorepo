import type { IUserEventStore } from "@repo/application";
import type { DomainEvent } from "@repo/domain";
import { asc, eq } from "drizzle-orm";
import type { DrizzleDB } from "../database/drizzle.client.js";
import { eventStore } from "../database/schema.js";

/**
 * DrizzleEventStore — implements IUserEventStore.
 */
export class DrizzleEventStore implements IUserEventStore {
  constructor(private readonly db: DrizzleDB) {}

  async append(
    aggregateId: string,
    events: ReadonlyArray<DomainEvent>,
  ): Promise<void> {
    if (events.length === 0) return;

    await this.db.insert(eventStore).values(
      events.map((event) => ({
        id: crypto.randomUUID(), // Or how you generate IDs
        aggregateId,
        eventType: event.eventType,
        payload: JSON.parse(JSON.stringify(event)) as object,
        version: event.version,
        occurredAt: event.occurredAt,
      })),
    );
  }

  async getEvents(aggregateId: string): Promise<DomainEvent[]> {
    const entries = await this.db.query.eventStore.findMany({
      where: eq(eventStore.aggregateId, aggregateId),
      orderBy: [asc(eventStore.version)],
    });

    return entries.map((e) => e.payload as unknown as DomainEvent);
  }

  async getEventsByType(eventType: string): Promise<DomainEvent[]> {
    const entries = await this.db.query.eventStore.findMany({
      where: eq(eventStore.eventType, eventType),
      orderBy: [asc(eventStore.occurredAt)],
    });

    return entries.map((e) => e.payload as unknown as DomainEvent);
  }
}
