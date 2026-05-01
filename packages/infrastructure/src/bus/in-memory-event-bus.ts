import type { IEventBus } from "@repo/application";
import type { DomainEvent } from "@repo/domain";
import { type AppError, type Result, ok } from "@repo/shared";

type EventHandler = (event: DomainEvent) => Promise<void>;

/**
 * InMemoryEventBus — simple in-process pub/sub event bus.
 *
 * Replace with Redis Streams / RabbitMQ / Kafka adapter for production
 * distributed event-driven architectures.
 */
export class InMemoryEventBus implements IEventBus {
  private readonly handlers = new Map<string, EventHandler[]>();

  subscribe(eventType: string, handler: EventHandler): void {
    const existing = this.handlers.get(eventType) ?? [];
    this.handlers.set(eventType, [...existing, handler]);
  }

  async publish(event: DomainEvent): Promise<Result<void, AppError>> {
    const handlers = this.handlers.get(event.eventType) ?? [];
    const results = await Promise.allSettled(handlers.map((h) => h(event)));

    const failures = results.filter((r) => r.status === "rejected");
    if (failures.length > 0) {
      console.error(
        `Event bus: ${failures.length} handlers failed for event ${event.eventType}`,
      );
    }

    return ok(undefined);
  }

  async publishAll(
    events: ReadonlyArray<DomainEvent>,
  ): Promise<Result<void, AppError>> {
    await Promise.allSettled(events.map((e) => this.publish(e)));
    return ok(undefined);
  }
}
