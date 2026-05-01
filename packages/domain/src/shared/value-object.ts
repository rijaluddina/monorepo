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
    if (vo === null || vo === undefined) return false;
    // biome-ignore lint/suspicious/noExplicitAny: needed for runtime inheritance check
    if (!(vo instanceof (this.constructor as any))) return false;
    return this.deepEqual(this.props, vo.props);
  }

  private deepEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (a instanceof Date && b instanceof Date)
      return a.getTime() === b.getTime();
    if (!a || !b || (typeof a !== "object" && typeof b !== "object"))
      return a === b;

    const objA = a as Record<string, unknown>;
    const objB = b as Record<string, unknown>;

    const keys = Object.keys(objA);
    if (keys.length !== Object.keys(objB).length) return false;
    return keys.every((k) => this.deepEqual(objA[k], objB[k]));
  }
}
