/**
 * DomainEvent — Marker interface for all domain events.
 *
 * Domain events represent something that happened in the domain.
 * They are the foundation of Event Sourcing.
 */
export interface DomainEvent {
  /** The aggregate that raised this event */
  readonly aggregateId: string;
  /** The event type/name (e.g. "UserCreated") */
  readonly eventType: string;
  /** When the event occurred */
  readonly occurredAt: Date;
  /** Sequential version of the event within the aggregate stream */
  readonly version: number;
}

/** Base implementation of DomainEvent */
export abstract class BaseDomainEvent implements DomainEvent {
  public readonly aggregateId: string;
  public readonly eventType: string;
  public readonly occurredAt: Date;
  public readonly version: number;

  constructor(aggregateId: string, eventType: string, version: number) {
    this.aggregateId = aggregateId;
    this.eventType = eventType;
    this.occurredAt = new Date();
    this.version = version;
  }
}
