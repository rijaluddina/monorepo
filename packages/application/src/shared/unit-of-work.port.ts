import type { AppError, PersistenceContext, Result } from "@repo/shared";

/**
 * IUnitOfWork — Port for managing atomic transactions.
 */
export interface IUnitOfWork {
  /**
   * Run a set of operations within a transaction.
   * @param work Function that performs the work, receiving the persistence context.
   */
  run<T>(
    work: (ctx: PersistenceContext) => Promise<Result<T, AppError>>,
  ): Promise<Result<T, AppError>>;
}
