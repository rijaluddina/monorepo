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

/** Opaque handle for persistence transactions/sessions */
export type PersistenceContext = Record<string, unknown>;

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
