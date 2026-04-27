import { User } from "@repo/domain";
import { ConflictError, err, ok } from "@repo/shared";
import type { Result } from "@repo/shared";
import type { CommandHandler } from "../../shared/command-handler.js";
import type { IEventBus } from "../../shared/event-bus.port.js";
import type { UserDTO } from "../dto/user.dto.js";
import type { IUserEventStore } from "../ports/user-event-store.port.js";
import type { IUserRepository } from "../ports/user-repository.port.js";
import { mapUserToDTO } from "../user.mapper.js";
import type { CreateUserCommand } from "./create-user.command.js";

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
  implements CommandHandler<CreateUserCommand, UserDTO> {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly eventStore: IUserEventStore,
    private readonly eventBus: IEventBus,
  ) {}

  async handle(command: CreateUserCommand): Promise<Result<UserDTO>> {
    // 1. Guard: duplicate email
    const exists = await this.userRepository.existsByEmail(command.email);
    if (exists) {
      return err(new ConflictError(`Email "${command.email}" already registered`));
    }

    // 2. Create aggregate — domain validates, emits events
    const user = User.create({
      firstName: command.firstName,
      lastName: command.lastName,
      email: command.email,
      role: command.role,
    });

    // 3. Persist to DB (write model)
    await this.userRepository.save(user);

    // 4. Append events to event store (Event Sourcing)
    await this.eventStore.append(user.id.value, user.domainEvents);

    // 5. Publish events to bus (async event-driven reactions)
    await this.eventBus.publishAll(user.domainEvents);

    // 6. Clear events from aggregate memory
    user.clearEvents();

    return ok(mapUserToDTO(user));
  }
}
