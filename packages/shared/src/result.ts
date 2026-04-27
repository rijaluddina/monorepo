/**
 * Result<T, E> — A functional error handling monad.
 *
 * Avoids throwing exceptions for expected business errors.
 * Forces callers to explicitly handle both success and failure cases.
 */

export type Result<T, E extends Error = Error> = Ok<T, E> | Err<T, E>;

export class Ok<T, E extends Error = Error> {
  public readonly ok = true as const;
  public readonly value: T;

  private constructor(value: T) {
    this.value = value;
  }

  public static create<T, E extends Error = Error>(value: T): Ok<T, E> {
    return new Ok(value);
  }

  public isOk(): this is Ok<T, E> {
    return true;
  }

  public isErr(): this is Err<T, E> {
    return false;
  }

  public unwrap(): T {
    return this.value;
  }

  public map<U>(fn: (value: T) => U): Result<U, E> {
    return ok(fn(this.value));
  }

  public flatMap<U>(fn: (value: T) => Result<U, E>): Result<U, E> {
    return fn(this.value);
  }

  public getOrElse(_default: T): T {
    return this.value;
  }
}

export class Err<T, E extends Error = Error> {
  public readonly ok = false as const;
  public readonly error: E;

  private constructor(error: E) {
    this.error = error;
  }

  public static create<T, E extends Error = Error>(error: E): Err<T, E> {
    return new Err(error);
  }

  public isOk(): this is Ok<T, E> {
    return false;
  }

  public isErr(): this is Err<T, E> {
    return true;
  }

  public unwrap(): never {
    throw this.error;
  }

  public map<U>(_fn: (value: T) => U): Result<U, E> {
    return err<U, E>(this.error);
  }

  public flatMap<U>(_fn: (value: T) => Result<U, E>): Result<U, E> {
    return err<U, E>(this.error);
  }

  public getOrElse(defaultValue: T): T {
    return defaultValue;
  }
}

/** Shorthand factory for Ok */
export function ok<T, E extends Error = Error>(value: T): Ok<T, E> {
  return Ok.create<T, E>(value);
}

/** Shorthand factory for Err */
export function err<T, E extends Error = Error>(error: E): Err<T, E> {
  return Err.create<T, E>(error);
}

/** Type guard: is the result Ok? */
export function isOk<T, E extends Error>(result: Result<T, E>): result is Ok<T, E> {
  return result.ok === true;
}

/** Type guard: is the result Err? */
export function isErr<T, E extends Error>(result: Result<T, E>): result is Err<T, E> {
  return result.ok === false;
}
