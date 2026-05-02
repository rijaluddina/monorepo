import type { IEventStore } from "@repo/application";
import type { DomainEvent } from "@repo/domain";
import {
  AppError,
  ConflictError,
  type PersistenceContext,
  type Result,
  err,
  ok,
} from "@repo/shared";
import { asc, eq } from "drizzle-orm";
import type { DrizzleDB } from "../database/drizzle.client.ts";
import { fromPersistenceContext } from "../database/persistence-context.ts";
import { eventStore } from "../database/schema.ts";

type StoredEvent = DomainEvent & Record<string, unknown>;

interface StoredEventRecord {
  aggregateId: unknown;
  eventType: unknown;
  payload: unknown;
  version: unknown;
  occurredAt: unknown;
}

/**
 * DrizzleEventStore — implements IEventStore.
 */
export class DrizzleEventStore implements IEventStore {
  constructor(private readonly db: DrizzleDB) {}

  private getDb(ctx?: PersistenceContext): DrizzleDB {
    return ctx ? fromPersistenceContext(ctx) : this.db;
  }

  private toInfrastructureError(error: unknown): AppError {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Database operation failed";
    return new AppError(message, "INFRASTRUCTURE_ERROR");
  }

  private isAggregateVersionConflict(error: unknown): boolean {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505" &&
      "constraint" in error &&
      error.constraint === "event_store_aggregate_version_idx"
    );
  }

  private cloneEventPayload(event: DomainEvent): Record<string, unknown> {
    return Object.fromEntries(Object.entries(structuredClone(event)));
  }

  private toStoredEvent(
    record: StoredEventRecord,
  ): Result<StoredEvent, AppError> {
    if (
      typeof record.aggregateId !== "string" ||
      typeof record.eventType !== "string" ||
      typeof record.version !== "number" ||
      !(record.occurredAt instanceof Date) ||
      typeof record.payload !== "object" ||
      record.payload === null ||
      Array.isArray(record.payload)
    ) {
      return err(
        new AppError("Malformed stored event record", "INFRASTRUCTURE_ERROR"),
      );
    }

    const payload = record.payload as Record<string, unknown>;
    return ok({
      ...payload,
      aggregateId: record.aggregateId,
      eventType: record.eventType,
      version: record.version,
      occurredAt: record.occurredAt,
    });
  }

  private toStoredEvents(
    records: StoredEventRecord[],
  ): Result<DomainEvent[], AppError> {
    const events: DomainEvent[] = [];
    for (const record of records) {
      const eventResult = this.toStoredEvent(record);
      if (eventResult.isErr()) return err(eventResult.error);
      events.push(eventResult.value);
    }
    return ok(events);
  }

  async append(
    aggregateId: string,
    events: ReadonlyArray<DomainEvent>,
    ctx?: PersistenceContext,
  ): Promise<Result<void, AppError>> {
    if (events.length === 0) return ok();

    const db = this.getDb(ctx);
    try {
      await db.insert(eventStore).values(
        events.map((event) => ({
          id: crypto.randomUUID(),
          aggregateId,
          eventType: event.eventType,
          payload: this.cloneEventPayload(event),
          version: event.version,
          occurredAt: event.occurredAt,
        })),
      );

      return ok();
    } catch (error) {
      if (this.isAggregateVersionConflict(error)) {
        return err(
          new ConflictError(
            `Concurrent modification detected for aggregate "${aggregateId}"`,
          ),
        );
      }
      return err(this.toInfrastructureError(error));
    }
  }

  async getEvents(
    aggregateId: string,
    ctx?: PersistenceContext,
  ): Promise<Result<DomainEvent[], AppError>> {
    const db = this.getDb(ctx);
    try {
      const entries = await db.query.eventStore.findMany({
        where: eq(eventStore.aggregateId, aggregateId),
        orderBy: [asc(eventStore.version)],
      });

      return this.toStoredEvents(entries);
    } catch (error) {
      return err(this.toInfrastructureError(error));
    }
  }

  async getEventsByType(
    eventType: string,
    ctx?: PersistenceContext,
  ): Promise<Result<DomainEvent[], AppError>> {
    const db = this.getDb(ctx);
    try {
      const entries = await db.query.eventStore.findMany({
        where: eq(eventStore.eventType, eventType),
        orderBy: [asc(eventStore.occurredAt)],
      });

      return this.toStoredEvents(entries);
    } catch (error) {
      return err(this.toInfrastructureError(error));
    }
  }
}
