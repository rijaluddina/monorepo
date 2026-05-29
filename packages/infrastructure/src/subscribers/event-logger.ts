import type { IEventBus } from "@repo/application";
import type { DomainEvent } from "@repo/domain";
import type { Logger } from "@repo/shared";

/**
 * EventLogger — Subscriber that logs all domain events as they occur.
 *
 * Provides observability into the event stream. Useful for debugging,
 * monitoring, and audit trails. Subscribes to ALL event types.
 */
export class EventLogger {
  private readonly logger: Logger;
  private readonly eventBus: IEventBus;
  private readonly eventTypes: readonly string[];

  constructor(
    eventBus: IEventBus,
    logger: Logger,
    eventTypes: readonly string[],
  ) {
    this.eventBus = eventBus;
    this.logger = logger;
    this.eventTypes = eventTypes;
  }

  /**
   * Register handlers for all configured event types.
   */
  public register(): void {
    for (const type of this.eventTypes) {
      this.eventBus.subscribe(type, (event) => this.handle(event));
    }
  }

  private async handle(event: DomainEvent): Promise<void> {
    this.logger.info(
      `[EventLogger] ${event.eventType} — aggregate: ${event.aggregateId} (v${event.version})`,
    );
  }
}
