import type { DomainEvent } from "@repo/domain";
import type { AppError, PersistenceContext, Result } from "@repo/shared";

export interface IOutboxPort {
  insert(
    events: ReadonlyArray<DomainEvent>,
    ctx?: PersistenceContext,
  ): Promise<Result<void, AppError>>;
}
