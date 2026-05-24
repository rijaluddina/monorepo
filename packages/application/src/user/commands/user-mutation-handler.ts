import { UniqueId, type User } from "@repo/domain";
import { NotFoundError, err, isErr, ok } from "@repo/shared";
import type { AppError, Result } from "@repo/shared";
import type { IEventBus } from "../../shared/event-bus.port.ts";
import type { IEventStore } from "../../shared/event-store.port.ts";
import type { IOutboxPort } from "../../shared/ports/outbox.port.ts";
import type { IUnitOfWork } from "../../shared/unit-of-work.port.ts";
import type { IUserRepository } from "../ports/user-repository.port.ts";

type UserMutation = (user: User) => Result<void, AppError> | void;

export abstract class UserMutationHandler {
  constructor(
    protected readonly userRepository: IUserRepository,
    protected readonly eventStore: IEventStore,
    protected readonly eventBus: IEventBus,
    protected readonly outboxPort: IOutboxPort,
    protected readonly unitOfWork: IUnitOfWork,
  ) {}

  protected async mutateUser(
    userId: string,
    mutation: UserMutation,
  ): Promise<Result<void>> {
    const userResult = await this.findUser(userId);
    if (isErr(userResult)) return err(userResult.error);

    return this.commitMutation(userResult.value, mutation);
  }

  protected async findUser(
    userId: string,
    options?: { includeDeleted?: boolean },
  ): Promise<Result<User>> {
    const userResult = await this.userRepository.findById(
      userId,
      undefined,
      options,
    );
    if (isErr(userResult)) return err(userResult.error);

    const user = userResult.value;
    if (!user) return err(new NotFoundError("User", userId));

    return ok(user);
  }

  protected async commitMutation(
    user: User,
    mutation: UserMutation,
  ): Promise<Result<void>> {
    const mutationResult = mutation(user);
    if (mutationResult && isErr(mutationResult)) {
      return err(mutationResult.error);
    }

    // No events raised (no-op mutation) — nothing to persist
    if (user.domainEvents.length === 0) {
      return ok();
    }

    const transactionResult = await this.unitOfWork.run(async (ctx) => {
      // 1. Persist current state to Read Model (Synchronous Projection)
      const saveResult = await this.userRepository.save(user, ctx);
      if (isErr(saveResult)) return err(saveResult.error);

      // 2. Append events to event store (Event Sourcing)
      const appendResult = await this.eventStore.append(
        user.id.value,
        user.domainEvents,
        ctx,
      );
      if (isErr(appendResult)) return err(appendResult.error);

      // 3. Add to outbox for reliable publishing to external systems
      const outboxResult = await this.outboxPort.insert(user.domainEvents, ctx);
      if (isErr(outboxResult)) return err(outboxResult.error);

      return ok(undefined);
    });

    if (isErr(transactionResult)) return err(transactionResult.error);

    user.clearEvents();

    return ok();
  }
}
