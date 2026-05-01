import type { DomainEvent } from "@repo/domain";
import type { AppError, Result } from "@repo/shared";

export interface IEventStore {
  append(
    aggregateId: string,
    events: ReadonlyArray<DomainEvent>,
  ): Promise<Result<void, AppError>>;
  getEvents(aggregateId: string): Promise<Result<DomainEvent[], AppError>>;
  getEventsByType(eventType: string): Promise<Result<DomainEvent[], AppError>>;
}
