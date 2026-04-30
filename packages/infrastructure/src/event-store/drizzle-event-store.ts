import type { IUserEventStore } from "@repo/application";
import type { DomainEvent } from "@repo/domain";
import { type AppError, ok } from "@repo/shared";
import type { Result } from "@repo/shared";
import { asc, eq } from "drizzle-orm";
import type { DrizzleDB } from "../database/drizzle.client.ts";
import { eventStore } from "../database/schema.ts";

/**
 * DrizzleEventStore — implements IUserEventStore.
 */
export class DrizzleEventStore implements IUserEventStore {
  constructor(private readonly db: DrizzleDB) {}

  async append(
    aggregateId: string,
    events: ReadonlyArray<DomainEvent>,
  ): Promise<Result<void, AppError>> {
    if (events.length === 0) return ok();

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

    return ok();
  }

  async getEvents(
    aggregateId: string,
  ): Promise<Result<DomainEvent[], AppError>> {
    const entries = await this.db.query.eventStore.findMany({
      where: eq(eventStore.aggregateId, aggregateId),
      orderBy: [asc(eventStore.version)],
    });

    return ok(entries.map((e) => e.payload as unknown as DomainEvent));
  }

  async getEventsByType(
    eventType: string,
  ): Promise<Result<DomainEvent[], AppError>> {
    const entries = await this.db.query.eventStore.findMany({
      where: eq(eventStore.eventType, eventType),
      orderBy: [asc(eventStore.occurredAt)],
    });

    return ok(entries.map((e) => e.payload as unknown as DomainEvent));
  }
}
