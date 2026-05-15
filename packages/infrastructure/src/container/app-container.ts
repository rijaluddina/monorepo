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
  type IExternalEventBus,
  type IQueryBus,
  type IUnitOfWork,
} from "@repo/application";
import { InMemoryCommandBus } from "../bus/in-memory-command-bus.ts";
import { InMemoryEventBus } from "../bus/in-memory-event-bus.ts";
import { InMemoryQueryBus } from "../bus/in-memory-query-bus.ts";
import { RedisEventBus } from "../bus/redis-event-bus.ts";
import { DrizzleUnitOfWork } from "../database/drizzle-unit-of-work.ts";
import { db } from "../database/drizzle.client.ts";
import { DrizzleEventStore } from "../event-store/drizzle-event-store.ts";
import { UserProjection } from "../projections/user.projection.ts";
import { DrizzleOutboxRepository } from "../repositories/drizzle-outbox.repository.ts";
import { DrizzleUserRepository } from "../repositories/drizzle-user.repository.ts";

/**
 * AppContainer — Composition Root.
 *
 * Single place where ALL dependencies are wired together.
 * This is where Dependency Inversion is resolved: abstractions
 * are matched to their concrete implementations.
 *
 * Usage:
 *   const container = new AppContainer();
 *   const bus = container.commandBus;
 */
export class AppContainer {
  public readonly commandBus: ICommandBus;
  public readonly queryBus: IQueryBus;
  public readonly eventBus: IEventBus;
  public readonly externalEventBus: IExternalEventBus;
  public readonly unitOfWork: IUnitOfWork;
  public readonly userProjection: UserProjection;

  constructor() {
    // ── Instantiate infrastructure implementations ──────────────────────
    const eventStore = new DrizzleEventStore(db);
    const userRepository = new DrizzleUserRepository(db, eventStore);
    const outboxRepository = new DrizzleOutboxRepository(db);

    // Use Redis for distributed events if REDIS_URL is provided
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
    const eventBus =
      process.env.NODE_ENV === "test"
        ? new InMemoryEventBus()
        : new RedisEventBus(redisUrl);

    const externalEventBus = eventBus as IExternalEventBus;

    const commandBus = new InMemoryCommandBus();
    const queryBus = new InMemoryQueryBus();
    const unitOfWork = new DrizzleUnitOfWork(db);

    // ── Instantiate projections ─────────────────────────────────────────
    this.userProjection = new UserProjection(eventBus, userRepository);
    this.userProjection.register();

    // ── Instantiate application handlers (inject ports) ─────────────────
    const createUserHandler = new CreateUserCommandHandler(
      userRepository,
      eventStore,
      eventBus,
      outboxRepository,
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
        outboxRepository,
        unitOfWork,
      ),
    );
    commandBus.register(
      "DeactivateUserCommand",
      new DeactivateUserCommandHandler(
        userRepository,
        eventStore,
        eventBus,
        outboxRepository,
        unitOfWork,
      ),
    );
    commandBus.register(
      "ChangeUserEmailCommand",
      new ChangeUserEmailCommandHandler(
        userRepository,
        eventStore,
        eventBus,
        outboxRepository,
        unitOfWork,
      ),
    );
    commandBus.register(
      "ChangeUserRoleCommand",
      new ChangeUserRoleCommandHandler(
        userRepository,
        eventStore,
        eventBus,
        outboxRepository,
        unitOfWork,
      ),
    );
    commandBus.register(
      "DeleteUserCommand",
      new DeleteUserCommandHandler(
        userRepository,
        eventStore,
        eventBus,
        outboxRepository,
        unitOfWork,
      ),
    );

    queryBus.register("GetUsersQuery", getUsersHandler);
    queryBus.register("GetUserByIdQuery", getUserByIdHandler);

    this.commandBus = commandBus;
    this.queryBus = queryBus;
    this.eventBus = eventBus;
    this.externalEventBus = externalEventBus;
    this.unitOfWork = unitOfWork;
  }
}

/**
 * Factory function to create a new AppContainer instance.
 */
export function createAppContainer(): AppContainer {
  return new AppContainer();
}
