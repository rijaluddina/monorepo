import type { AppError, Result } from "@repo/shared";
import type { Query } from "./query.js";

/**
 * IQueryBus — Port (Dependency Inversion).
 * Infrastructure provides the implementation.
 */
export interface IQueryBus {
  ask<TQuery extends Query, TResult>(
    query: TQuery,
  ): Promise<Result<TResult, AppError>>;
  register<TQuery extends Query, TResult>(
    queryName: string,
    handler: {
      handle(q: TQuery): Promise<Result<TResult>>;
    },
  ): void;
}
