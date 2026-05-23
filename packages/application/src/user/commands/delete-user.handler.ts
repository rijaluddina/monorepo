import { ConflictError, err, isErr } from "@repo/shared";
import type { Result } from "@repo/shared";
import type { CommandHandler } from "../../shared/command-handler.ts";
import type { IEventBus } from "../../shared/event-bus.port.ts";
import type { IEventStore } from "../../shared/event-store.port.ts";
import type { IOutboxPort } from "../../shared/ports/outbox.port.ts";
import type { IUnitOfWork } from "../../shared/unit-of-work.port.ts";
import type { IUserRepository } from "../ports/user-repository.port.ts";
import type { DeleteUserCommand } from "./delete-user.command.ts";
import { UserMutationHandler } from "./user-mutation-handler.ts";

export class DeleteUserCommandHandler
  extends UserMutationHandler
  implements CommandHandler<DeleteUserCommand, void>
{
  async handle(command: DeleteUserCommand): Promise<Result<void>> {
    // Find user including deleted ones so we can check for conflict
    const userResult = await this.findUser(command.userId, {
      includeDeleted: true,
    });
    if (isErr(userResult)) return err(userResult.error);

    const user = userResult.value;

    // Return 409 if the user is already deleted
    if (user.isDeleted) {
      return err(
        new ConflictError(`User "${command.userId}" is already deleted`),
      );
    }

    return this.commitMutation(user, (deletedUser) => {
      deletedUser.delete();
    });
  }
}
