import type { DomainEvent } from "@repo/domain";
import type { AppError, Result } from "@repo/shared";

/**
 * IExternalEventBus — Port for publishing domain events to an external Message Broker
 * (e.g., RabbitMQ, Kafka, Redis Streams).
 */
export interface IExternalEventBus {
  publish(event: DomainEvent): Promise<Result<void, AppError>>;
}
