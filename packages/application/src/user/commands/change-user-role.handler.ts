import type { Result } from "@repo/shared";
import type { CommandHandler } from "../../shared/command-handler.ts";
import type { ChangeUserRoleCommand } from "./change-user-role.command.ts";
import { UserMutationHandler } from "./user-mutation-handler.ts";

export class ChangeUserRoleCommandHandler
  extends UserMutationHandler
  implements CommandHandler<ChangeUserRoleCommand, void>
{
  async handle(command: ChangeUserRoleCommand): Promise<Result<void>> {
    return this.mutateUser(command.userId, (user) =>
      user.changeRole(command.role),
    );
  }
}
