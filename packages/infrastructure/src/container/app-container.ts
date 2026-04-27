import { prisma } from "../database/prisma.client.js";
import { PrismaUserRepository } from "../repositories/prisma-user.repository.js";
import { PrismaEventStore } from "../event-store/prisma-event-store.js";
import { InMemoryCommandBus } from "../bus/in-memory-command-bus.js";
import { InMemoryQueryBus } from "../bus/in-memory-query-bus.js";
import { InMemoryEventBus } from "../bus/in-memory-event-bus.js";
import {
  CreateUserCommandHandler,
  GetUsersQueryHandler,
  GetUserByIdQueryHandler,
} from "@repo/application";

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
    const userRepository = new PrismaUserRepository(prisma);
    const eventStore = new PrismaEventStore(prisma);
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
