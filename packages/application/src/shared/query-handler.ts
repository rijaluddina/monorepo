import type { Result } from "@repo/shared";
import type { Query } from "./query.js";

/** Each query has exactly one handler */
export interface QueryHandler<TQuery extends Query, TResult> {
  handle(query: TQuery): Promise<Result<TResult>>;
}
