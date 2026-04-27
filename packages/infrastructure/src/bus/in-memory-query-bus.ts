import type { IQueryBus, Query } from "@repo/application";
import type { Result } from "@repo/shared";
import { AppError, err } from "@repo/shared";

type AnyHandler = { handle(q: Query): Promise<Result<unknown>> };

/**
 * InMemoryQueryBus — routes queries to their registered handlers.
 */
export class InMemoryQueryBus implements IQueryBus {
  private readonly handlers = new Map<string, AnyHandler>();

  register<TQuery extends Query, TResult>(
    queryName: string,
    handler: { handle(q: TQuery): Promise<Result<TResult>> },
  ): void {
    if (this.handlers.has(queryName)) {
      throw new Error(`QueryBus: duplicate handler for "${queryName}"`);
    }
    this.handlers.set(queryName, handler as unknown as AnyHandler);
  }

  async ask<TQuery extends Query, TResult>(query: TQuery): Promise<Result<TResult>> {
    const name = query.constructor.name;
    const handler = this.handlers.get(name);
    if (!handler) {
      return err(new AppError(`No handler registered for query "${name}"`, "NO_HANDLER", 500));
    }
    return handler.handle(query) as Promise<Result<TResult>>;
  }
}
