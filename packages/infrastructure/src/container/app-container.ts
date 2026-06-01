import {
  ActivateUserCommandHandler,
  ChangeUserEmailCommandHandler,
  ChangeUserRoleCommandHandler,
  CreateUserCommandHandler,
  DeactivateUserCommandHandler,
  DeleteUserCommandHandler,
  GetUserByIdQueryHandler,
  GetUsersQueryHandler,
  type ICache,
  type ICommandBus,
  type IQueryBus,
  type IUnitOfWork,
  RestoreUserCommandHandler,
} from "@repo/application";
import {
  ConsoleLogger,
  type IDisposable,
  type Logger,
  isDisposable,
} from "@repo/shared";
import { InMemoryCommandBus } from "../bus/in-memory-command-bus.ts";
import { InMemoryEventBus } from "../bus/in-memory-event-bus.ts";
import { InMemoryQueryBus } from "../bus/in-memory-query-bus.ts";
import { RedisEventBus } from "../bus/redis-event-bus.ts";
import { NoOpCache } from "../cache/noop.cache.ts";
import { RedisCache } from "../cache/redis.cache.ts";
import { DrizzleUnitOfWork } from "../database/drizzle-unit-of-work.ts";
import { getDb, getPool } from "../database/drizzle.client.ts";
import type { DrizzleDB } from "../database/drizzle.client.ts";
import { DrizzleEventStore } from "../event-store/drizzle-event-store.ts";
import { stopOutboxProcessor } from "../outbox/processor.ts";
import { getRedisClients } from "../redis/redis.client.ts";
import { DrizzleOutboxRepository } from "../repositories/drizzle-outbox.repository.ts";
import { DrizzleUserRepository } from "../repositories/drizzle-user.repository.ts";
import { EventLogger } from "../subscribers/event-logger.ts";

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
/** Default disconnect timeout per resource: 30 seconds */
const DEFAULT_DISCONNECT_TIMEOUT_MS = 30_000;

export function createAppContainer(
  db: DrizzleDB = getDb(),
  logger: Logger = new ConsoleLogger(),
  disconnectTimeoutMs: number = DEFAULT_DISCONNECT_TIMEOUT_MS,
) {
  // ── Collect resources that need cleanup on shutdown ─────────────────
  // New IDisposable resources can be pushed here as they are created;
  // disconnect() will iterate through them automatically.
  const disposables: IDisposable[] = [];

  // ── Instantiate infrastructure implementations ──────────────────────
  const eventStore = new DrizzleEventStore(db);
  const userRepository = new DrizzleUserRepository(db, eventStore);
  const outboxRepository = new DrizzleOutboxRepository(db);

  // Internal event bus (in-process) — subscribers react in real-time
  // within the same process. Always InMemoryEventBus: no serialization
  // overhead for local subscribers.
  const eventBus = new InMemoryEventBus(logger);

  // Query result cache — Redis in production, NoOp in test mode
  const cache: ICache =
    process.env.NODE_ENV === "test" ? new NoOpCache() : new RedisCache(logger);

  // External event bus (distributed) — publishes to other services via
  // Redis Pub/Sub. The outbox processor uses this for reliable delivery.
  // In test mode we use InMemoryEventBus to avoid requiring Redis.
  const externalEventBus =
    process.env.NODE_ENV === "test"
      ? new InMemoryEventBus(logger)
      : new RedisEventBus(getRedisClients(), logger);

  // Register externalEventBus for cleanup if it implements IDisposable
  if (isDisposable(externalEventBus)) {
    disposables.push(externalEventBus);
  }

  // ── Register outbox processor for cleanup ───────────────────────────
  // Stopped first so no new events are published during shutdown.
  disposables.push({
    name: "outbox processor",
    disconnect: () => stopOutboxProcessor(logger),
  });

  // ── Register database pool for cleanup ───────────────────────────────
  // Closed last — all other cleanup runs before the DB is unavailable.
  disposables.push({
    name: "database pool",
    disconnect: () => getPool().end(),
  });

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
  const getUserByIdHandler = new GetUserByIdQueryHandler(userRepository, cache);

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
      cache,
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
      cache,
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
      cache,
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
      cache,
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
      cache,
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
      cache,
    ),
  );

  queryBus.register("GetUsersQuery", getUsersHandler);
  queryBus.register("GetUserByIdQuery", getUserByIdHandler);

  // ── Register internal subscribers ──────────────────────────────────
  // EventLogger logs all domain events for observability.
  const eventTypes = [
    "UserCreated",
    "UserActivated",
    "UserDeactivated",
    "UserEmailChanged",
    "UserRoleChanged",
    "UserDeleted",
    "UserRestored",
  ] as const;
  const eventLogger = new EventLogger(eventBus, logger, eventTypes);
  eventLogger.register();

  return {
    commandBus,
    queryBus,
    eventBus,
    externalEventBus,
    unitOfWork,
    /**
     * Register an external resource for cleanup on shutdown.
     *
     * Registered disposables run first (e.g. HTTP server stop),
     * followed by internal resources (outbox → Redis → DB pool).
     */
    registerDisposable: (disposable: IDisposable) => {
      // unshift so externally-registered resources (e.g. HTTP server)
      // are disconnected FIRST — stop accepting new connections
      // before shutting down internal infrastructure.
      disposables.unshift(disposable);
    },
    disconnect: async (): Promise<AggregateError> => {
      const errors: Error[] = [];

      for (const disposable of disposables) {
        const label = disposable.name ?? "unknown";
        try {
          // Wrap each resource cleanup with a timeout so that
          // a single hanging resource cannot block shutdown forever.
          let timer: ReturnType<typeof setTimeout> | undefined;
          try {
            await Promise.race([
              disposable.disconnect(),
              new Promise<never>((_, reject) => {
                timer = setTimeout(
                  () =>
                    reject(
                      new Error(
                        `Disconnect timed out after ${disconnectTimeoutMs}ms [${label}]`,
                      ),
                    ),
                  disconnectTimeoutMs,
                );
              }),
            ]);
          } finally {
            if (timer) clearTimeout(timer);
          }
        } catch (error) {
          logger.error(`Disconnect error [${label}]:`, error);
          // Continue with remaining disposables — one failure
          // must not prevent other resources from cleaning up.
          errors.push(
            error instanceof Error ? error : new Error(String(error)),
          );
        }
      }
      return new AggregateError(
        errors,
        errors.length === 0
          ? "Clean shutdown"
          : `Shutdown completed with ${errors.length} error(s)`,
      );
    },
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
