/**
 * UniqueId — Strongly-typed value object wrapping a string ID.
 * Immutable. Supports random generation and equality comparison.
 */
export class UniqueId {
  private readonly _value: string;

  constructor(id?: string) {
    this._value = id ?? crypto.randomUUID();
  }

  get value(): string {
    return this._value;
  }

  public equals(other: UniqueId): boolean {
    return this._value === other._value;
  }

  public toString(): string {
    return this._value;
  }
}
