import type { DomainEvent } from "./domain-event.js";
import { Entity } from "./entity.js";
import type { UniqueId } from "./identifier.js";

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
  private _version = 0;

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
}
