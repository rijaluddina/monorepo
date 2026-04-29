import type { DomainEvent } from "@repo/domain";
import type { Result, AppError } from "@repo/shared";

/**
 * IEventBus — Port for publishing domain events.
 * Infrastructure provides async, potentially distributed implementation.
 */
export interface IEventBus {
  publish(event: DomainEvent): Promise<Result<void, AppError>>;
  publishAll(events: ReadonlyArray<DomainEvent>): Promise<Result<void, AppError>>;
  subscribe(
    eventType: string,
    handler: (event: DomainEvent) => Promise<void>,
  ): void;
}
