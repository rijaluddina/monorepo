import {
  ActivateUserCommandHandler,
  ChangeUserEmailCommandHandler,
  ChangeUserRoleCommandHandler,
  CreateUserCommandHandler,
  DeactivateUserCommandHandler,
  DeleteUserCommandHandler,
  GetUserByIdQueryHandler,
  GetUsersQueryHandler,
  type ICommandBus,
  type IEventBus,
  type IQueryBus,
  type IUnitOfWork,
} from "@repo/application";
import { InMemoryCommandBus } from "../bus/in-memory-command-bus.ts";
import { InMemoryEventBus } from "../bus/in-memory-event-bus.ts";
import { InMemoryQueryBus } from "../bus/in-memory-query-bus.ts";
import { DrizzleUnitOfWork } from "../database/drizzle-unit-of-work.ts";
import { db } from "../database/drizzle.client.ts";
import { DrizzleEventStore } from "../event-store/drizzle-event-store.ts";
import { DrizzleUserRepository } from "../repositories/drizzle-user.repository.ts";

/**
 * AppContainer — Composition Root.
 *
 * Single place where ALL dependencies are wired together.
 * This is where Dependency Inversion is resolved: abstractions
 * are matched to their concrete implementations.
 *
 * Usage:
 *   const container = AppContainer.getInstance();
 *   const bus = container.commandBus;
 */
export class AppContainer {
  private static instance: AppContainer;

  public readonly commandBus: ICommandBus;
  public readonly queryBus: IQueryBus;
  public readonly eventBus: IEventBus;
  public readonly unitOfWork: IUnitOfWork;

  private constructor() {
    // ── Instantiate infrastructure implementations ──────────────────────
    const eventStore = new DrizzleEventStore(db);
    const userRepository = new DrizzleUserRepository(db, eventStore);
    const eventBus = new InMemoryEventBus();
    const commandBus = new InMemoryCommandBus();
    const queryBus = new InMemoryQueryBus();
    const unitOfWork = new DrizzleUnitOfWork(db);

    // ── Instantiate application handlers (inject ports) ─────────────────
    const createUserHandler = new CreateUserCommandHandler(
      userRepository,
      eventStore,
      eventBus,
      unitOfWork,
    );
    const getUsersHandler = new GetUsersQueryHandler(userRepository);
    const getUserByIdHandler = new GetUserByIdQueryHandler(userRepository);

    // ── Register handlers on buses ──────────────────────────────────────
    commandBus.register("CreateUserCommand", createUserHandler);
    commandBus.register(
      "ActivateUserCommand",
      new ActivateUserCommandHandler(
        userRepository,
        eventStore,
        eventBus,
        unitOfWork,
      ),
    );
    commandBus.register(
      "DeactivateUserCommand",
      new DeactivateUserCommandHandler(
        userRepository,
        eventStore,
        eventBus,
        unitOfWork,
      ),
    );
    commandBus.register(
      "ChangeUserEmailCommand",
      new ChangeUserEmailCommandHandler(
        userRepository,
        eventStore,
        eventBus,
        unitOfWork,
      ),
    );
    commandBus.register(
      "ChangeUserRoleCommand",
      new ChangeUserRoleCommandHandler(
        userRepository,
        eventStore,
        eventBus,
        unitOfWork,
      ),
    );
    commandBus.register(
      "DeleteUserCommand",
      new DeleteUserCommandHandler(
        userRepository,
        eventStore,
        eventBus,
        unitOfWork,
      ),
    );

    queryBus.register("GetUsersQuery", getUsersHandler);
    queryBus.register("GetUserByIdQuery", getUserByIdHandler);

    this.commandBus = commandBus;
    this.queryBus = queryBus;
    this.eventBus = eventBus;
    this.unitOfWork = unitOfWork;
  }

  public static getInstance(): AppContainer {
    if (!AppContainer.instance) {
      AppContainer.instance = new AppContainer();
    }
    return AppContainer.instance;
  }
}
