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
  RestoreUserCommandHandler,
} from "@repo/application";
import { InMemoryCommandBus } from "../bus/in-memory-command-bus.ts";
import { InMemoryEventBus } from "../bus/in-memory-event-bus.ts";
import { InMemoryQueryBus } from "../bus/in-memory-query-bus.ts";
import { RedisEventBus } from "../bus/redis-event-bus.ts";
import { DrizzleUnitOfWork } from "../database/drizzle-unit-of-work.ts";
import { db as defaultDb } from "../database/drizzle.client.ts";
import type { DrizzleDB } from "../database/drizzle.client.ts";
import { DrizzleEventStore } from "../event-store/drizzle-event-store.ts";
import { DrizzleOutboxRepository } from "../repositories/drizzle-outbox.repository.ts";
import { DrizzleUserRepository } from "../repositories/drizzle-user.repository.ts";

/**
 * Factory function that creates and wires the AppContainer.
 *
 * This is the Composition Root — all dependencies are instantiated
 * and injected here. No `new` keyword needed by consumers.
 *
 * The return type is inferred from the returned object literal.
 * `AppContainer` is derived via `ReturnType<typeof createAppContainer>`
 * so the interface stays in sync with the implementation automatically.
 */
export function createAppContainer(db: DrizzleDB = defaultDb) {
  // ── Instantiate infrastructure implementations ──────────────────────
  const eventStore = new DrizzleEventStore(db);
  const userRepository = new DrizzleUserRepository(db, eventStore);
  const outboxRepository = new DrizzleOutboxRepository(db);

  // Use Redis for distributed events if REDIS_URL is provided
  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
  const eventBus: IEventBus =
    process.env.NODE_ENV === "test"
      ? new InMemoryEventBus()
      : new RedisEventBus(redisUrl);

  const externalEventBus: IExternalEventBus = eventBus as IExternalEventBus;

  const commandBus: ICommandBus = new InMemoryCommandBus();
  const queryBus: IQueryBus = new InMemoryQueryBus();
  const unitOfWork: IUnitOfWork = new DrizzleUnitOfWork(db);

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
  commandBus.register(
    "RestoreUserCommand",
    new RestoreUserCommandHandler(
      userRepository,
      eventStore,
      eventBus,
      outboxRepository,
      unitOfWork,
    ),
  );

  queryBus.register("GetUsersQuery", getUsersHandler);
  queryBus.register("GetUserByIdQuery", getUserByIdHandler);

  return {
    commandBus,
    queryBus,
    eventBus,
    externalEventBus,
    unitOfWork,
  };
}

/**
 * AppContainer — Composition Root contract (derived from createAppContainer).
 *
 * Single place where ALL dependencies are wired together.
 * This is where Dependency Inversion is resolved: abstractions
 * are matched to their concrete implementations.
 *
 * The type is inferred from the factory function so it automatically
 * stays in sync with the implementation. If a new bus or service is
 * added to the return value, the type updates without manual edits.
 */
export type AppContainer = Readonly<ReturnType<typeof createAppContainer>>;
