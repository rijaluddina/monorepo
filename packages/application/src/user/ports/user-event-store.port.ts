import type { DomainEvent } from "@repo/domain";
import type { AppError, Result } from "@repo/shared";

/**
 * IUserEventStore — Port for Event Sourcing persistence.
 * Append-only log of all domain events per aggregate stream.
 */
export interface IUserEventStore {
  /** Append new events to the stream for an aggregate */
  append(
    aggregateId: string,
    events: ReadonlyArray<DomainEvent>,
  ): Promise<Result<void, AppError>>;
  /** Replay all events for a given aggregate (for reconstitution) */
  getEvents(aggregateId: string): Promise<Result<DomainEvent[], AppError>>;
  /** Get all events of a specific type across all aggregates */
  getEventsByType(eventType: string): Promise<Result<DomainEvent[], AppError>>;
}
