import type { IUnitOfWork } from "@repo/application";
import type { AppError, PersistenceContext, Result } from "@repo/shared";
import type { DrizzleDB } from "./drizzle.client.ts";

/**
 * DrizzleUnitOfWork — implements IUnitOfWork using Drizzle transactions.
 */
export class DrizzleUnitOfWork implements IUnitOfWork {
  constructor(private readonly db: DrizzleDB) {}

  async run<T>(
    work: (ctx: PersistenceContext) => Promise<Result<T, AppError>>,
  ): Promise<Result<T, AppError>> {
    return await this.db.transaction(async (tx) => {
      // tx has the same API as db, so it satisfies DrizzleDB
      return await work(tx as unknown as PersistenceContext);
    });
  }
}
