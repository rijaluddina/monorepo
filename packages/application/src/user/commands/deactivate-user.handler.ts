import type { Result } from "@repo/shared";
import type { CommandHandler } from "../../shared/command-handler.ts";
import type { DeactivateUserCommand } from "./deactivate-user.command.ts";
import { UserMutationHandler } from "./user-mutation-handler.ts";

export class DeactivateUserCommandHandler
  extends UserMutationHandler
  implements CommandHandler<DeactivateUserCommand, void>
{
  async handle(command: DeactivateUserCommand): Promise<Result<void>> {
    return this.mutateUser(command.userId, (user) => user.deactivate());
  }
}
