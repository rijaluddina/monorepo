import type { Query } from "./query.js";

/**
 * IQueryBus — Port (Dependency Inversion).
 * Infrastructure provides the implementation.
 */
export interface IQueryBus {
  ask<TQuery extends Query, TResult>(query: TQuery): Promise<TResult>;
  register<TQuery extends Query, TResult>(
    queryName: string,
    handler: { handle(q: TQuery): Promise<import("@repo/shared").Result<TResult>> },
  ): void;
}
