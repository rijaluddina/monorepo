import type { IEventStore } from "@repo/application";
import type { DomainEvent } from "@repo/domain";
import {
  type AppError,
  type PersistenceContext,
  type Result,
  ok,
} from "@repo/shared";
import { asc, eq } from "drizzle-orm";
import type { DrizzleDB } from "../database/drizzle.client.ts";
import { eventStore } from "../database/schema.ts";

/**
 * DrizzleEventStore — implements IEventStore.
 */
export class DrizzleEventStore implements IEventStore {
  constructor(private readonly db: DrizzleDB) {}

  private getDb(ctx?: PersistenceContext): DrizzleDB {
    return ctx ? (ctx as unknown as DrizzleDB) : this.db;
  }

  async append(
    aggregateId: string,
    events: ReadonlyArray<DomainEvent>,
    ctx?: PersistenceContext,
  ): Promise<Result<void, AppError>> {
    if (events.length === 0) return ok();

    const db = this.getDb(ctx);
    await db.insert(eventStore).values(
      events.map((event) => ({
        id: crypto.randomUUID(),
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
    ctx?: PersistenceContext,
  ): Promise<Result<DomainEvent[], AppError>> {
    const db = this.getDb(ctx);
    const entries = await db.query.eventStore.findMany({
      where: eq(eventStore.aggregateId, aggregateId),
      orderBy: [asc(eventStore.version)],
    });

    return ok(
      entries.map((e) => {
        const payload = e.payload as any;
        return {
          ...payload,
          aggregateId: e.aggregateId,
          eventType: e.eventType,
          version: e.version,
          occurredAt: e.occurredAt, // This is a Date object from Drizzle
        } as unknown as DomainEvent;
      }),
    );
  }

  async getEventsByType(
    eventType: string,
    ctx?: PersistenceContext,
  ): Promise<Result<DomainEvent[], AppError>> {
    const db = this.getDb(ctx);
    const entries = await db.query.eventStore.findMany({
      where: eq(eventStore.eventType, eventType),
      orderBy: [asc(eventStore.occurredAt)],
    });

    return ok(
      entries.map((e) => {
        const payload = e.payload as any;
        return {
          ...payload,
          aggregateId: e.aggregateId,
          eventType: e.eventType,
          version: e.version,
          occurredAt: e.occurredAt, // This is a Date object from Drizzle
        } as unknown as DomainEvent;
      }),
    );
  }
}
