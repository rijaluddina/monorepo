import type { DomainEvent } from "./domain-event.ts";
import { Entity } from "./entity.ts";
import type { UniqueId } from "./identifier.ts"; // Not used

/**
 * AggregateRoot<T> — Consistency boundary for a cluster of entities.
 *
 * Extends Entity by maintaining an internal list of uncommitted
 * domain events. The application layer is responsible for:
 *   1. Reading & dispatching those events (to the event bus)
 *   2. Persisting them (to the event store)
 *   3. Clearing them after dispatch
 */
export abstract class AggregateRoot<T> extends Entity<T> {
  private _domainEvents: DomainEvent[] = [];
  protected _version = 0;

  get domainEvents(): ReadonlyArray<DomainEvent> {
    return this._domainEvents;
  }

  get version(): number {
    return this._version;
  }

  protected addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
    this._version++;
  }

  public clearEvents(): void {
    this._domainEvents = [];
  }

  /**
   * Apply a domain event to the aggregate state.
   * This method must be implemented by concrete aggregates to update
   * their internal state based on the event type.
   */
  protected abstract apply(event: DomainEvent): void;

  /**
   * Replay a stream of domain events to reconstitute the aggregate state.
   * Used for Event Sourcing reconstitution.
   */
  public replay(events: DomainEvent[]): void {
    for (const event of events) {
      this.apply(event);
      this._version = event.version;
    }
  }
}
