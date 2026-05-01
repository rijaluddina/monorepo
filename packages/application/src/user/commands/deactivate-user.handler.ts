import { NotFoundError, err, isErr, ok } from "@repo/shared";
import type { Result } from "@repo/shared";
import type { CommandHandler } from "../../shared/command-handler.ts";
import type { IEventBus } from "../../shared/event-bus.port.ts";
import type { IEventStore } from "../../shared/event-store.port.ts";
import type { IUserRepository } from "../ports/user-repository.port.ts";
import type { DeactivateUserCommand } from "./deactivate-user.command.ts";

export class DeactivateUserCommandHandler
  implements CommandHandler<DeactivateUserCommand, void>
{
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly eventStore: IEventStore,
    private readonly eventBus: IEventBus,
  ) {}

  async handle(command: DeactivateUserCommand): Promise<Result<void>> {
    const userResult = await this.userRepository.findById(command.userId);
    if (isErr(userResult)) {
      return err(userResult.error);
    }
    const user = userResult.value;

    if (!user) {
      return err(new NotFoundError("User", command.userId));
    }

    user.deactivate();

    const saveResult = await this.userRepository.save(user);
    if (isErr(saveResult)) {
      return err(saveResult.error);
    }

    const appendResult = await this.eventStore.append(
      user.id.value,
      user.domainEvents,
    );
    if (isErr(appendResult)) {
      return err(appendResult.error);
    }

    const publishResult = await this.eventBus.publishAll(user.domainEvents);
    if (isErr(publishResult)) {
      return err(publishResult.error);
    }

    user.clearEvents();

    return ok();
  }
}
