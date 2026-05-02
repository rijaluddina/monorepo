import type { Result } from "@repo/shared";
import type { CommandHandler } from "../../shared/command-handler.ts";
import type { ActivateUserCommand } from "./activate-user.command.ts";
import { UserMutationHandler } from "./user-mutation-handler.ts";

export class ActivateUserCommandHandler
  extends UserMutationHandler
  implements CommandHandler<ActivateUserCommand, void>
{
  async handle(command: ActivateUserCommand): Promise<Result<void>> {
    return this.mutateUser(command.userId, (user) => user.activate());
  }
}
