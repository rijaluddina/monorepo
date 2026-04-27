import type { UniqueId } from "./identifier.js";

/**
 * Entity<T> — A domain object identified by its unique ID.
 *
 * Two entities are equal if they share the same ID,
 * regardless of their other properties.
 */
export abstract class Entity<T> {
  protected readonly _id: UniqueId;
  protected props: T;

  constructor(props: T, id: UniqueId) {
    this._id = id;
    this.props = props;
  }

  get id(): UniqueId {
    return this._id;
  }

  public equals(entity: Entity<T>): boolean {
    if (!(entity instanceof this.constructor)) return false;
    return this._id.equals(entity._id);
  }
}
