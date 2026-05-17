import { err, isErr, ok } from "@repo/shared";
import type { Result } from "@repo/shared";
import type { CommandHandler } from "../../shared/command-handler.ts";
import type { RestoreUserCommand } from "./restore-user.command.ts";
import { UserMutationHandler } from "./user-mutation-handler.ts";

export class RestoreUserCommandHandler
  extends UserMutationHandler
  implements CommandHandler<RestoreUserCommand, void>
{
  async handle(command: RestoreUserCommand): Promise<Result<void>> {
    // 1. Find user including deleted ones
    const userResult = await this.findUser(command.userId, {
      includeDeleted: true,
    });
    if (isErr(userResult)) return err(userResult.error);

    // 2. Commit mutation
    return this.commitMutation(userResult.value, (user) => {
      user.restore();
    });
  }
}
