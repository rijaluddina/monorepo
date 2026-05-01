import { NotFoundError, err, isErr, ok } from "@repo/shared";
import type { Result } from "@repo/shared";
import type { CommandHandler } from "../../shared/command-handler.ts";
import type { IEventBus } from "../../shared/event-bus.port.ts";
import type { IEventStore } from "../../shared/event-store.port.ts";
import type { IUnitOfWork } from "../../shared/unit-of-work.port.ts";
import type { IUserRepository } from "../ports/user-repository.port.ts";
import type { DeleteUserCommand } from "./delete-user.command.ts";

export class DeleteUserCommandHandler
  implements CommandHandler<DeleteUserCommand, void>
{
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly eventStore: IEventStore,
    private readonly eventBus: IEventBus,
    private readonly unitOfWork: IUnitOfWork,
  ) {}

  async handle(command: DeleteUserCommand): Promise<Result<void>> {
    const userResult = await this.userRepository.findById(command.userId);
    if (isErr(userResult)) return err(userResult.error);

    const user = userResult.value;
    if (!user) {
      return err(new NotFoundError("User", command.userId));
    }

    // In this domain, we delete the user.
    // We could also just deactivate them (soft delete).
    // Let's do hard delete for this example.

    const transactionResult = await this.unitOfWork.run(async (ctx) => {
      const deleteResult = await this.userRepository.delete(user.id.value, ctx);
      if (isErr(deleteResult)) return err(deleteResult.error);

      // We might want to record a UserDeleted event before the user record is gone,
      // or just rely on the event store.
      // user.delete(); // If we had a delete method that raises an event

      return ok(undefined);
    });

    if (isErr(transactionResult)) {
      return err(transactionResult.error);
    }

    // Usually events are published AFTER the aggregate is gone from state but exists in history.
    // If we had a UserDeleted event, we'd publish it here.

    return ok();
  }
}
