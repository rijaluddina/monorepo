import type { DomainEvent } from "@repo/domain";
import type { AppError, PersistenceContext, Result } from "@repo/shared";

export interface IEventStore {
  append(
    aggregateId: string,
    events: ReadonlyArray<DomainEvent>,
    ctx?: PersistenceContext,
  ): Promise<Result<void, AppError>>;
  getEvents(
    aggregateId: string,
    ctx?: PersistenceContext,
  ): Promise<Result<DomainEvent[], AppError>>;
  getEventsByType(
    eventType: string,
    ctx?: PersistenceContext,
  ): Promise<Result<DomainEvent[], AppError>>;
}
