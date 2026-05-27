import { User } from "@repo/domain";
import { type AppError, ConflictError, err, isErr, ok } from "@repo/shared";
import type { Result } from "@repo/shared";
import type { CommandHandler } from "../../shared/command-handler.ts";
import type { IEventBus } from "../../shared/event-bus.port.ts";
import type { IEventStore } from "../../shared/event-store.port.ts";
import type { IOutboxPort } from "../../shared/ports/outbox.port.ts";
import type { IUnitOfWork } from "../../shared/unit-of-work.port.ts";
import type { UserDTO } from "@repo/shared";
import type { IUserRepository } from "../ports/user-repository.port.ts";
import { mapUserToDTO } from "../user.mapper.ts";
import type { CreateUserCommand } from "./create-user.command.ts";

/**
 * CreateUserCommandHandler — orchestrates user creation.
 *
 * Flow:
 *  1. Guard: email unique
 *  2. Create User aggregate (domain events collected internally)
 *  3. Persist to repository (write model)
 *  4. Append domain events to event store (Event Sourcing log)
 *  5. Publish events to event bus (subscribers react async)
 *  6. Return DTO
 */
export class CreateUserCommandHandler
  implements CommandHandler<CreateUserCommand, UserDTO>
{
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly eventStore: IEventStore,
    private readonly eventBus: IEventBus,
    private readonly outboxPort: IOutboxPort,
    private readonly unitOfWork: IUnitOfWork,
  ) {}

  async handle(command: CreateUserCommand): Promise<Result<UserDTO, AppError>> {
    // 1. Check for duplicates
    const existsResult = await this.userRepository.existsByEmail(command.email);
    if (isErr(existsResult)) return err(existsResult.error);

    if (existsResult.value) {
      return err(
        new ConflictError(`User with email "${command.email}" already exists`),
      );
    }

    // 2. Build domain entity
    const userResult = User.create({
      firstName: command.firstName,
      lastName: command.lastName,
      email: command.email,
      role: command.role,
    });

    if (isErr(userResult)) {
      return err(userResult.error);
    }

    const user = userResult.value;

    // ─── Transactional Boundary ──────────────────────────────────────────
    const transactionResult = await this.unitOfWork.run(async (ctx) => {
      // 3. Persist current state to Read Model (Synchronous Projection)
      const saveResult = await this.userRepository.save(user, ctx);
      if (isErr(saveResult)) return err(saveResult.error);

      // 4. Append events to event store (Event Sourcing)
      const appendResult = await this.eventStore.append(
        user.id.value,
        user.domainEvents,
        ctx,
      );
      if (isErr(appendResult)) return err(appendResult.error);

      // 5. Add to outbox for reliable publishing
      const outboxResult = await this.outboxPort.insert(user.domainEvents, ctx);
      if (isErr(outboxResult)) return err(outboxResult.error);

      return ok(undefined);
    });

    if (isErr(transactionResult)) {
      return err(transactionResult.error);
    }

    // 6. Clear events from aggregate memory
    user.clearEvents();

    // 7. Return DTO
    return ok(mapUserToDTO(user));
  }
}
