import { NotFoundError, err, isErr, ok } from "@repo/shared";
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
  constructor(
    userRepository: IUserRepository,
    eventStore: IEventStore,
    eventBus: IEventBus,
    outboxPort: IOutboxPort,
    unitOfWork: IUnitOfWork,
  ) {
    super(userRepository, eventStore, eventBus, outboxPort, unitOfWork);
  }

  async handle(command: DeleteUserCommand): Promise<Result<void>> {
    return this.mutateUser(command.userId, (user) => {
      user.delete();
    });
  }
}
