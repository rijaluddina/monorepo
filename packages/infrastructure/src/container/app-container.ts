import {
  CreateUserCommandHandler,
  GetUserByIdQueryHandler,
  GetUsersQueryHandler,
} from "@repo/application";
import { InMemoryCommandBus } from "../bus/in-memory-command-bus.ts";
import { InMemoryEventBus } from "../bus/in-memory-event-bus.ts";
import { InMemoryQueryBus } from "../bus/in-memory-query-bus.ts";
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

  public readonly commandBus: InMemoryCommandBus;
  public readonly queryBus: InMemoryQueryBus;
  public readonly eventBus: InMemoryEventBus;

  private constructor() {
    // ── Instantiate infrastructure implementations ──────────────────────
    const userRepository = new DrizzleUserRepository(db);
    const eventStore = new DrizzleEventStore(db);
    const eventBus = new InMemoryEventBus();
    const commandBus = new InMemoryCommandBus();
    const queryBus = new InMemoryQueryBus();

    // ── Instantiate application handlers (inject ports) ─────────────────
    const createUserHandler = new CreateUserCommandHandler(
      userRepository,
      eventStore,
      eventBus,
    );
    const getUsersHandler = new GetUsersQueryHandler(userRepository);
    const getUserByIdHandler = new GetUserByIdQueryHandler(userRepository);

    // ── Register handlers on buses ──────────────────────────────────────
    commandBus.register("CreateUserCommand", createUserHandler);
    queryBus.register("GetUsersQuery", getUsersHandler);
    queryBus.register("GetUserByIdQuery", getUserByIdHandler);

    this.commandBus = commandBus;
    this.queryBus = queryBus;
    this.eventBus = eventBus;
  }

  public static getInstance(): AppContainer {
    if (!AppContainer.instance) {
      AppContainer.instance = new AppContainer();
    }
    return AppContainer.instance;
  }
}
