/**
 * ValueObject<T> — Immutable, self-validating domain primitive.
 *
 * Equality is based on structural comparison of the inner props,
 * not reference identity.
 */
export abstract class ValueObject<T> {
  protected readonly props: T;

  constructor(props: T) {
    this.validate(props);
    this.props = Object.freeze({ ...(props as object) }) as T;
  }

  /** Override to add invariant validation. Throw on invalid input. */
  protected abstract validate(props: T): void;

  public equals(vo: ValueObject<T>): boolean {
    if (!(vo instanceof this.constructor)) return false;
    return JSON.stringify(this.props) === JSON.stringify(vo.props);
  }
}
