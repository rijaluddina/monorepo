import type { IExternalEventBus } from "@repo/application";
import type { DomainEvent } from "@repo/domain";
import { type AppError, type Result, ok } from "@repo/shared";

/**
 * ConsoleExternalEventBus — A mock implementation that logs to console.
 * In a real-world scenario, this would use an AMQP client, Kafka producer, etc.
 */
export class ConsoleExternalEventBus implements IExternalEventBus {
  async publish(event: DomainEvent): Promise<Result<void, AppError>> {
    console.log(
      `[External Broker] 📡 Publishing event: ${event.eventType} for aggregate: ${event.aggregateId}`,
    );
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 50));
    return ok(undefined);
  }
}
