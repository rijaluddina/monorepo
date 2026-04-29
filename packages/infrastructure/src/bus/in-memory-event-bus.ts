import type { IEventBus } from "@repo/application";
import type { DomainEvent } from "@repo/domain";

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

  async publish(event: DomainEvent): Promise<void> {
    const handlers = this.handlers.get(event.eventType) ?? [];
    await Promise.all(handlers.map((h) => h(event)));
  }

  async publishAll(events: ReadonlyArray<DomainEvent>): Promise<void> {
    await Promise.all(events.map((e) => this.publish(e)));
  }
}
