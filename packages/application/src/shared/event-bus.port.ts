import type { DomainEvent } from "@repo/domain";

/**
 * IEventBus — Port for publishing domain events.
 * Infrastructure provides async, potentially distributed implementation.
 */
export interface IEventBus {
  publish(event: DomainEvent): Promise<void>;
  publishAll(events: ReadonlyArray<DomainEvent>): Promise<void>;
  subscribe(
    eventType: string,
    handler: (event: DomainEvent) => Promise<void>,
  ): void;
}
