import type { DomainEvent } from "@repo/domain";
import type { IUserEventStore } from "@repo/application";
import type { PrismaClient } from "../database/prisma.client.js";

/**
 * PrismaEventStore — implements IUserEventStore.
 *
 * Append-only. Each row = one domain event.
 * Payload stored as JSON — enables full event replay for reconstitution.
 */
export class PrismaEventStore implements IUserEventStore {
  constructor(private readonly prisma: PrismaClient) {}

  async append(aggregateId: string, events: ReadonlyArray<DomainEvent>): Promise<void> {
    if (events.length === 0) return;

    await this.prisma.eventStoreEntry.createMany({
      data: events.map((event) => ({
        aggregateId,
        eventType: event.eventType,
        payload: JSON.parse(JSON.stringify(event)) as object,
        version: event.version,
        occurredAt: event.occurredAt,
      })),
    });
  }

  async getEvents(aggregateId: string): Promise<DomainEvent[]> {
    const entries = await this.prisma.eventStoreEntry.findMany({
      where: { aggregateId },
      orderBy: { version: "asc" },
    });

    return entries.map((e) => e.payload as unknown as DomainEvent);
  }

  async getEventsByType(eventType: string): Promise<DomainEvent[]> {
    const entries = await this.prisma.eventStoreEntry.findMany({
      where: { eventType },
      orderBy: { occurredAt: "asc" },
    });

    return entries.map((e) => e.payload as unknown as DomainEvent);
  }
}
