import { ConflictError, err, isErr } from "@repo/shared";
import type { Result } from "@repo/shared";
import type { CommandHandler } from "../../shared/command-handler.ts";
import type { ChangeUserEmailCommand } from "./change-user-email.command.ts";
import { UserMutationHandler } from "./user-mutation-handler.ts";

export class ChangeUserEmailCommandHandler
  extends UserMutationHandler
  implements CommandHandler<ChangeUserEmailCommand, void>
{
  async handle(command: ChangeUserEmailCommand): Promise<Result<void>> {
    const userResult = await this.findUser(command.userId);
    if (isErr(userResult)) return err(userResult.error);

    const user = userResult.value;

    if (user.email.value !== command.email) {
      const existsResult = await this.userRepository.existsByEmail(
        command.email,
      );
      if (isErr(existsResult)) {
        return err(existsResult.error);
      }
      if (existsResult.value) {
        return err(
          new ConflictError(`Email "${command.email}" already registered`),
        );
      }
    }

    return this.commitMutation(user, (user) => user.changeEmail(command.email));
  }
}
