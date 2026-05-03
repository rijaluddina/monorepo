import { type Result, ok } from "@repo/shared";
import type { DomainEvent } from "./domain-event.ts";
import { Entity } from "./entity.ts";

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

  protected setVersion(version: number): void {
    this._version = version;
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
  // biome-ignore lint/suspicious/noExplicitAny: error type can vary by domain
  protected abstract apply(event: DomainEvent): Result<void, any>;

  /**
   * Replay a stream of domain events to reconstitute the aggregate state.
   * Used for Event Sourcing reconstitution.
   */
  // biome-ignore lint/suspicious/noExplicitAny: error type can vary by domain
  public replay(events: DomainEvent[]): Result<void, any> {
    for (const event of events) {
      const result = this.apply(event);
      if (result.isErr()) return result;
      this._version = event.version;
    }
    return ok(undefined);
  }
}
