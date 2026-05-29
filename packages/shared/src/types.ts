/** Optional type — value may be undefined */
export type Optional<T> = T | undefined;

/** Nullable type — value may be null */
export type Nullable<T> = T | null;

/** Make all properties of T deeply readonly */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

/** Extract values of an object as a union type */
export type ValueOf<T> = T[keyof T];

/** Make specific keys optional */
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/** Make specific keys required */
export type RequireBy<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

/** Primitive types */
export type Primitive =
  | string
  | number
  | boolean
  | bigint
  | symbol
  | null
  | undefined;

/** A plain JS object (record) */
export type PlainObject = Record<string, unknown>;

declare const persistenceContextBrand: unique symbol;

/** Opaque handle for persistence transactions/sessions */
export type PersistenceContext = {
  readonly [persistenceContextBrand]: "PersistenceContext";
};

/**
 * IDisposable — Interface for resources that need cleanup.
 * Implementations should free underlying connections when called.
 *
 * The optional {@link name} property is used by container to identify
 * which resource failed during shutdown in error messages.
 */
export interface IDisposable {
  /** Human-readable label for error messages (e.g. "HTTP server", "Redis bus") */
  name?: string;
  disconnect(): Promise<void>;
}

/**
 * Logger — Minimal logger abstraction for dependency injection.
 *
 * Consumers can inject any logger implementation (winston, pino, …)
 * or pass no logger to use {@link console} by default.
 */
export interface Logger {
  error(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  info(...args: unknown[]): void;
  debug(...args: unknown[]): void;
}

/**
 * Type guard that checks whether an unknown value implements IDisposable.
 *
 * Use this to safely collect resources into a disposables array
 * without type assertions.
 *
 * @example
 *   const disposables: IDisposable[] = [];
 *   if (isDisposable(someObj)) {
 *     disposables.push(someObj);  // TypeScript narrows to IDisposable
 *   }
 */
export function isDisposable(obj: unknown): obj is IDisposable {
  if (obj === null || typeof obj !== "object") return false;
  try {
    return typeof (obj as IDisposable).disconnect === "function";
  } catch {
    // Getter threw — treat as not disposable
    return false;
  }
}

/** Pagination params */
export interface PaginationParams {
  page: number;
  limit: number;
}

/** Paginated response */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
