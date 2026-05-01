import { NotFoundError, err, isErr, ok } from "@repo/shared";
import type { Result } from "@repo/shared";
import type { CommandHandler } from "../../shared/command-handler.ts";
import type { IEventBus } from "../../shared/event-bus.port.ts";
import type { IEventStore } from "../../shared/event-store.port.ts";
import type { IUnitOfWork } from "../../shared/unit-of-work.port.ts";
import type { IUserRepository } from "../ports/user-repository.port.ts";
import type { ChangeUserRoleCommand } from "./change-user-role.command.ts";

export class ChangeUserRoleCommandHandler
  implements CommandHandler<ChangeUserRoleCommand, void>
{
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly eventStore: IEventStore,
    private readonly eventBus: IEventBus,
    private readonly unitOfWork: IUnitOfWork,
  ) {}

  async handle(command: ChangeUserRoleCommand): Promise<Result<void>> {
    const userResult = await this.userRepository.findById(command.userId);
    if (isErr(userResult)) {
      return err(userResult.error);
    }
    const user = userResult.value;

    if (!user) {
      return err(new NotFoundError("User", command.userId));
    }

    user.changeRole(command.role);

    const transactionResult = await this.unitOfWork.run(async (ctx) => {
      const saveResult = await this.userRepository.save(user, ctx);
      if (isErr(saveResult)) return err(saveResult.error);

      const appendResult = await this.eventStore.append(
        user.id.value,
        user.domainEvents,
        ctx,
      );
      if (isErr(appendResult)) return err(appendResult.error);

      return ok(undefined);
    });

    if (isErr(transactionResult)) {
      return err(transactionResult.error);
    }

    const publishResult = await this.eventBus.publishAll(user.domainEvents);
    if (isErr(publishResult)) {
      return err(publishResult.error);
    }

    user.clearEvents();

    return ok();
  }
}
