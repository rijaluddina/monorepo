import type { IOutboxPort } from "@repo/application";
import type { DomainEvent } from "@repo/domain";
import {
  AppError,
  type PersistenceContext,
  type Result,
  err,
  ok,
} from "@repo/shared";
import { eq } from "drizzle-orm";
import type { DrizzleDB } from "../database/drizzle.client.ts";
import { fromPersistenceContext } from "../database/persistence-context.ts";
import { outbox } from "../database/schema.ts";

/**
 * DrizzleOutboxRepository — implements IOutboxPort via Drizzle + PostgreSQL.
 */
export class DrizzleOutboxRepository implements IOutboxPort {
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

  async insert(
    events: ReadonlyArray<DomainEvent>,
    ctx?: PersistenceContext,
  ): Promise<Result<void, AppError>> {
    if (events.length === 0) return ok();

    const db = this.getDb(ctx);
    try {
      await db.insert(outbox).values(
        events.map((event) => ({
          id: crypto.randomUUID(),
          aggregateId: event.aggregateId,
          eventType: event.eventType,
          payload: event,
        })),
      );

      return ok();
    } catch (error) {
      return err(this.toInfrastructureError(error));
    }
  }
}
