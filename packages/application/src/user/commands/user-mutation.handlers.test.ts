import { type Mock, beforeEach, describe, expect, mock, test } from "bun:test";
import {
  USER_CREATED,
  USER_DELETED,
  User,
  UserActivatedEvent,
  UserDeletedEvent,
  UserEmailChangedEvent,
  UserRoleChangedEvent,
} from "@repo/domain";
import { AppError, ConflictError, NotFoundError, err, ok } from "@repo/shared";
import type { ICache } from "../../shared/cache.port.ts";
import type { IEventBus } from "../../shared/event-bus.port.ts";
import type { IEventStore } from "../../shared/event-store.port.ts";
import type { IOutboxPort } from "../../shared/ports/outbox.port.ts";
import type { IUnitOfWork } from "../../shared/unit-of-work.port.ts";
import type { IUserRepository } from "../ports/user-repository.port.ts";
import { GetUserByIdQueryHandler } from "../queries/get-user-by-id.handler.ts";
import { GetUserByIdQuery } from "../queries/get-user-by-id.query.ts";
import { ActivateUserCommand } from "./activate-user.command.ts";
import { ActivateUserCommandHandler } from "./activate-user.handler.ts";
import { ChangeUserEmailCommand } from "./change-user-email.command.ts";
import { ChangeUserEmailCommandHandler } from "./change-user-email.handler.ts";
import { ChangeUserRoleCommand } from "./change-user-role.command.ts";
import { ChangeUserRoleCommandHandler } from "./change-user-role.handler.ts";
import { DeleteUserCommand } from "./delete-user.command.ts";
import { DeleteUserCommandHandler } from "./delete-user.handler.ts";

function createUser(
  overrides: Partial<Parameters<typeof User.create>[0]> = {},
) {
  const result = User.create({
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
    role: "member",
    ...overrides,
  });

  if (result.isErr()) throw result.error;
  result.value.clearEvents();
  return result.value;
}

describe("User mutation command handlers", () => {
  let userRepository: IUserRepository;
  let eventStore: IEventStore;
  let eventBus: IEventBus;
  let outboxPort: IOutboxPort;
  let unitOfWork: IUnitOfWork;
  let cache: ICache;
  const txContext = { tx: true };

  beforeEach(() => {
    userRepository = {
      existsByEmail: mock(),
      save: mock(),
      findById: mock(),
      findByEmail: mock(),
      findAll: mock(),
      delete: mock(),
    } as unknown as IUserRepository;

    eventStore = {
      append: mock(),
      getEvents: mock(),
      getEventsByType: mock(),
    } as unknown as IEventStore;

    eventBus = {
      publish: mock(),
      publishAll: mock(),
      subscribe: mock(),
    } as unknown as IEventBus;

    outboxPort = {
      insert: mock(),
    } as unknown as IOutboxPort;

    cache = {
      get: mock(),
      set: mock(),
      del: mock(),
    } as unknown as ICache;
    (cache.del as Mock<typeof cache.del>).mockResolvedValue(undefined);

    unitOfWork = {
      run: mock((work) => work(txContext)),
    } as unknown as IUnitOfWork;

    (userRepository.save as Mock<typeof userRepository.save>).mockResolvedValue(
      ok(undefined),
    );
    (
      userRepository.delete as Mock<typeof userRepository.delete>
    ).mockResolvedValue(ok(undefined));
    (eventStore.append as Mock<typeof eventStore.append>).mockResolvedValue(
      ok(undefined),
    );
    (outboxPort.insert as Mock<typeof outboxPort.insert>).mockResolvedValue(
      ok(undefined),
    );
    (eventBus.publishAll as Mock<typeof eventBus.publishAll>).mockResolvedValue(
      ok(undefined),
    );
  });

  test("activate should append, publish, and clear emitted events", async () => {
    const user = createUser();
    user.deactivate();
    user.clearEvents();
    (
      userRepository.findById as Mock<typeof userRepository.findById>
    ).mockResolvedValue(ok(user));

    const handler = new ActivateUserCommandHandler(
      userRepository,
      eventStore,
      eventBus,
      outboxPort,
      unitOfWork,
    );

    const result = await handler.handle(new ActivateUserCommand(user.id.value));

    expect(result.isOk()).toBe(true);
    expect(userRepository.save).toHaveBeenCalled();
    expect(eventStore.append).toHaveBeenCalledWith(
      user.id.value,
      [expect.any(UserActivatedEvent)],
      txContext,
    );
    expect(outboxPort.insert).toHaveBeenCalledWith(
      [expect.any(UserActivatedEvent)],
      txContext,
    );
    expect(user.domainEvents).toEqual([]);
    expect(eventBus.publishAll).toHaveBeenCalled();
  });

  test("change email should reject duplicate email before mutating", async () => {
    const user = createUser();
    (
      userRepository.findById as Mock<typeof userRepository.findById>
    ).mockResolvedValue(ok(user));
    (
      userRepository.existsByEmail as Mock<typeof userRepository.existsByEmail>
    ).mockResolvedValue(ok(true));
    const handler = new ChangeUserEmailCommandHandler(
      userRepository,
      eventStore,
      eventBus,
      outboxPort,
      unitOfWork,
    );

    const result = await handler.handle(
      new ChangeUserEmailCommand(user.id.value, "taken@example.com"),
    );

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error).toBeInstanceOf(ConflictError);
    expect(userRepository.save).not.toHaveBeenCalled();
    expect(eventStore.append).not.toHaveBeenCalled();
    expect(eventBus.publishAll).not.toHaveBeenCalled();
  });

  test("change email should update and append the email changed event", async () => {
    const user = createUser();
    (
      userRepository.findById as Mock<typeof userRepository.findById>
    ).mockResolvedValue(ok(user));
    (
      userRepository.existsByEmail as Mock<typeof userRepository.existsByEmail>
    ).mockResolvedValue(ok(false));
    const handler = new ChangeUserEmailCommandHandler(
      userRepository,
      eventStore,
      eventBus,
      outboxPort,
      unitOfWork,
    );

    const result = await handler.handle(
      new ChangeUserEmailCommand(user.id.value, "new@example.com"),
    );

    expect(result.isOk()).toBe(true);
    expect(userRepository.save).toHaveBeenCalled();
    expect(eventStore.append).toHaveBeenCalledWith(
      user.id.value,
      [expect.any(UserEmailChangedEvent)],
      txContext,
    );
    expect(eventBus.publishAll).toHaveBeenCalled();
  });

  test("change role should update and append the role changed event", async () => {
    const user = createUser();
    (
      userRepository.findById as Mock<typeof userRepository.findById>
    ).mockResolvedValue(ok(user));
    const handler = new ChangeUserRoleCommandHandler(
      userRepository,
      eventStore,
      eventBus,
      outboxPort,
      unitOfWork,
    );

    const result = await handler.handle(
      new ChangeUserRoleCommand(user.id.value, "admin"),
    );

    expect(result.isOk()).toBe(true);
    expect(userRepository.save).toHaveBeenCalled();
    expect(eventStore.append).toHaveBeenCalledWith(
      user.id.value,
      [expect.any(UserRoleChangedEvent)],
      txContext,
    );
    expect(eventBus.publishAll).toHaveBeenCalled();
  });

  test("mutation handlers should return not found when user is missing", async () => {
    (
      userRepository.findById as Mock<typeof userRepository.findById>
    ).mockResolvedValue(ok(undefined));
    const handler = new ActivateUserCommandHandler(
      userRepository,
      eventStore,
      eventBus,
      outboxPort,
      unitOfWork,
    );

    const result = await handler.handle(new ActivateUserCommand("missing-id"));

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error).toBeInstanceOf(NotFoundError);
    expect(unitOfWork.run).not.toHaveBeenCalled();
    expect(eventBus.publishAll).not.toHaveBeenCalled();
  });

  test("mutation handlers should stop when append fails", async () => {
    const user = createUser();
    user.deactivate();
    user.clearEvents();
    (
      userRepository.findById as Mock<typeof userRepository.findById>
    ).mockResolvedValue(ok(user));
    (eventStore.append as Mock<typeof eventStore.append>).mockResolvedValue(
      err(new AppError("append failed", "APPEND_FAILED")),
    );
    const handler = new ActivateUserCommandHandler(
      userRepository,
      eventStore,
      eventBus,
      outboxPort,
      unitOfWork,
    );

    const result = await handler.handle(new ActivateUserCommand(user.id.value));

    expect(result.isErr()).toBe(true);
    expect(outboxPort.insert).not.toHaveBeenCalled();
    expect(eventBus.publishAll).not.toHaveBeenCalled();
  });

  test("delete should append and publish UserDeletedEvent", async () => {
    const user = createUser();
    (
      userRepository.findById as Mock<typeof userRepository.findById>
    ).mockResolvedValue(ok(user));
    const handler = new DeleteUserCommandHandler(
      userRepository,
      eventStore,
      eventBus,
      outboxPort,
      unitOfWork,
    );

    const result = await handler.handle(new DeleteUserCommand(user.id.value));

    expect(result.isOk()).toBe(true);
    expect(eventStore.append).toHaveBeenCalledWith(
      user.id.value,
      [expect.any(UserDeletedEvent)],
      txContext,
    );
    expect(userRepository.save).toHaveBeenCalled();
    expect(eventBus.publishAll).toHaveBeenCalled();
  });

  // ─── Cache invalidation ──────────────────────────────────────────────

  describe("cache invalidation", () => {
    test("should invalidate cache after successful activate mutation", async () => {
      const user = createUser();
      user.deactivate();
      user.clearEvents();
      (
        userRepository.findById as Mock<typeof userRepository.findById>
      ).mockResolvedValue(ok(user));

      const handler = new ActivateUserCommandHandler(
        userRepository,
        eventStore,
        eventBus,
        outboxPort,
        unitOfWork,
        cache,
      );

      const result = await handler.handle(
        new ActivateUserCommand(user.id.value),
      );

      expect(result.isOk()).toBe(true);
      expect(cache.del).toHaveBeenCalledTimes(1);
      expect(cache.del).toHaveBeenCalledWith(`user:${user.id.value}`);
    });

    test("should invalidate cache after successful change email mutation", async () => {
      const user = createUser();
      (
        userRepository.findById as Mock<typeof userRepository.findById>
      ).mockResolvedValue(ok(user));
      (
        userRepository.existsByEmail as Mock<
          typeof userRepository.existsByEmail
        >
      ).mockResolvedValue(ok(false));

      const handler = new ChangeUserEmailCommandHandler(
        userRepository,
        eventStore,
        eventBus,
        outboxPort,
        unitOfWork,
        cache,
      );

      const result = await handler.handle(
        new ChangeUserEmailCommand(user.id.value, "new@example.com"),
      );

      expect(result.isOk()).toBe(true);
      expect(cache.del).toHaveBeenCalledWith(`user:${user.id.value}`);
    });

    test("should invalidate cache after successful delete mutation", async () => {
      const user = createUser();
      (
        userRepository.findById as Mock<typeof userRepository.findById>
      ).mockResolvedValue(ok(user));

      const handler = new DeleteUserCommandHandler(
        userRepository,
        eventStore,
        eventBus,
        outboxPort,
        unitOfWork,
        cache,
      );

      const result = await handler.handle(new DeleteUserCommand(user.id.value));

      expect(result.isOk()).toBe(true);
      expect(cache.del).toHaveBeenCalledWith(`user:${user.id.value}`);
    });

    test("should invalidate cache after successful change role mutation", async () => {
      const user = createUser();
      (
        userRepository.findById as Mock<typeof userRepository.findById>
      ).mockResolvedValue(ok(user));

      const handler = new ChangeUserRoleCommandHandler(
        userRepository,
        eventStore,
        eventBus,
        outboxPort,
        unitOfWork,
        cache,
      );

      const result = await handler.handle(
        new ChangeUserRoleCommand(user.id.value, "admin"),
      );

      expect(result.isOk()).toBe(true);
      expect(cache.del).toHaveBeenCalledWith(`user:${user.id.value}`);
    });

    test("should NOT invalidate cache when user not found (mutation never runs)", async () => {
      (
        userRepository.findById as Mock<typeof userRepository.findById>
      ).mockResolvedValue(ok(undefined));

      const handler = new ActivateUserCommandHandler(
        userRepository,
        eventStore,
        eventBus,
        outboxPort,
        unitOfWork,
        cache,
      );

      const result = await handler.handle(
        new ActivateUserCommand("missing-id"),
      );

      expect(result.isErr()).toBe(true);
      expect(cache.del).not.toHaveBeenCalled();
    });

    test("should NOT invalidate cache when append fails (transaction rolled back)", async () => {
      const user = createUser();
      user.deactivate();
      user.clearEvents();
      (
        userRepository.findById as Mock<typeof userRepository.findById>
      ).mockResolvedValue(ok(user));
      (eventStore.append as Mock<typeof eventStore.append>).mockResolvedValue(
        err(new AppError("append failed", "APPEND_FAILED")),
      );

      const handler = new ActivateUserCommandHandler(
        userRepository,
        eventStore,
        eventBus,
        outboxPort,
        unitOfWork,
        cache,
      );

      const result = await handler.handle(
        new ActivateUserCommand(user.id.value),
      );

      expect(result.isErr()).toBe(true);
      // Transaction didn't commit — cache should NOT be invalidated
      expect(cache.del).not.toHaveBeenCalled();
    });

    test("should NOT invalidate cache when mutation is a no-op (no events raised)", async () => {
      // An already-active user calling activate() raises no events
      const user = createUser(); // Already active (default)
      user.clearEvents();
      (
        userRepository.findById as Mock<typeof userRepository.findById>
      ).mockResolvedValue(ok(user));

      const handler = new ActivateUserCommandHandler(
        userRepository,
        eventStore,
        eventBus,
        outboxPort,
        unitOfWork,
        cache,
      );

      const result = await handler.handle(
        new ActivateUserCommand(user.id.value),
      );

      expect(result.isOk()).toBe(true);
      // No events raised → nothing persisted → cache untouched
      expect(unitOfWork.run).not.toHaveBeenCalled();
      expect(cache.del).not.toHaveBeenCalled();
    });

    test("should NOT invalidate cache on duplicate email (mutation rejected before commit)", async () => {
      const user = createUser();
      (
        userRepository.findById as Mock<typeof userRepository.findById>
      ).mockResolvedValue(ok(user));
      (
        userRepository.existsByEmail as Mock<
          typeof userRepository.existsByEmail
        >
      ).mockResolvedValue(ok(true));

      const handler = new ChangeUserEmailCommandHandler(
        userRepository,
        eventStore,
        eventBus,
        outboxPort,
        unitOfWork,
        cache,
      );

      const result = await handler.handle(
        new ChangeUserEmailCommand(user.id.value, "taken@example.com"),
      );

      expect(result.isErr()).toBe(true);
      expect(cache.del).not.toHaveBeenCalled();
    });
  });
});

describe("End-to-end: cache invalidation flow", () => {
  // ─── Factory helpers ───────────────────────────────────────────────────

  interface CacheTracker {
    cache: ICache;
    store: Map<string, string>;
    callCount: { get: number; set: number; del: number };
  }

  function createInMemoryCache(): CacheTracker {
    const store = new Map<string, string>();
    const callCount = { get: 0, set: 0, del: 0 };

    return {
      store,
      callCount,
      cache: {
        async get<T>(key: string): Promise<T | undefined> {
          callCount.get++;
          const raw = store.get(key);
          if (raw === undefined) return undefined;
          return JSON.parse(raw) as T;
        },
        async set(key: string, value: unknown): Promise<void> {
          callCount.set++;
          store.set(key, JSON.stringify(value));
        },
        async del(key: string): Promise<void> {
          callCount.del++;
          store.delete(key);
        },
      },
    };
  }

  function createStoreBackedRepo(
    userStore: Map<string, User>,
  ): IUserRepository {
    return {
      async findById(id) {
        const found = userStore.get(id);
        return found ? ok(found) : ok(undefined);
      },
      async existsByEmail(email) {
        const exists = Array.from(userStore.values()).some(
          (u) => u.email.value === email,
        );
        return ok(exists);
      },
      async findAll() {
        return ok({ users: [], total: 0 });
      },
      async save(u) {
        userStore.set(u.id.value, u);
        return ok(undefined);
      },
      async delete() {
        return ok(undefined);
      },
      async findByEmail() {
        return ok(undefined);
      },
    };
  }

  function createMockInfrastructure(): {
    eventStore: IEventStore;
    eventBus: IEventBus;
    outboxPort: IOutboxPort;
    unitOfWork: IUnitOfWork;
  } {
    return {
      eventStore: {
        async append() {
          return ok(undefined);
        },
        getEvents: mock(),
        getEventsByType: mock(),
      },
      eventBus: {
        publish: mock(),
        async publishAll() {
          return ok(undefined);
        },
        subscribe: mock(),
      },
      outboxPort: {
        async insert() {
          return ok(undefined);
        },
      },
      unitOfWork: {
        async run(work) {
          const ctx = { tx: true };
          // biome-ignore lint/suspicious/noExplicitAny: test helper — PersistenceContext is from infra layer
          return work(ctx as any);
        },
      },
    };
  }

  function createUserInStore(
    store: Map<string, User>,
    overrides?: Partial<Parameters<typeof User.create>[0]>,
  ): User {
    const user = createUser(overrides);
    user.clearEvents();
    store.set(user.id.value, user);
    return user;
  }

  function queryUser(handler: GetUserByIdQueryHandler, userId: string) {
    return handler.handle(new GetUserByIdQuery(userId));
  }

  // ─── Tests ───────────────────────────────────────────────────────────

  test("should return fresh data after mutation invalidates the cache", async () => {
    const userStore = new Map<string, User>();
    const user = createUserInStore(userStore);
    const { cache, store: cacheStore, callCount } = createInMemoryCache();
    const repo = createStoreBackedRepo(userStore);
    const { eventStore, eventBus, outboxPort, unitOfWork } =
      createMockInfrastructure();

    const queryHandler = new GetUserByIdQueryHandler(repo, cache);

    // ════════════════════════════════════════════════════════════════════
    // Step 1: Query → cache miss → populate cache
    // ════════════════════════════════════════════════════════════════════
    const result1 = await queryUser(queryHandler, user.id.value);
    expect(result1.isOk()).toBe(true);
    if (!result1.isOk()) return;
    expect(result1.value.email).toBe("ada@example.com");

    expect(callCount.set).toBe(1);
    const cached = cacheStore.get(`user:${user.id.value}`);
    expect(cached).toBeDefined();
    if (cached) {
      expect(JSON.parse(cached)).toEqual(
        expect.objectContaining({ email: "ada@example.com" }),
      );
    }

    // ════════════════════════════════════════════════════════════════════
    // Step 2: Mutation → change email → cache.del
    // ════════════════════════════════════════════════════════════════════
    const mutationHandler = new ChangeUserEmailCommandHandler(
      repo,
      eventStore,
      eventBus,
      outboxPort,
      unitOfWork,
      cache,
    );

    const mutationResult = await mutationHandler.handle(
      new ChangeUserEmailCommand(user.id.value, "new@example.com"),
    );
    expect(mutationResult.isOk()).toBe(true);

    expect(callCount.del).toBe(1);
    expect(cacheStore.has(`user:${user.id.value}`)).toBe(false);

    // ════════════════════════════════════════════════════════════════════
    // Step 3: Query again → cache miss → fetch fresh from repo
    // ════════════════════════════════════════════════════════════════════
    const result2 = await queryUser(queryHandler, user.id.value);
    expect(result2.isOk()).toBe(true);
    if (!result2.isOk()) return;

    expect(result2.value.email).toBe("new@example.com");
    expect(result2.value.id).toBe(user.id.value);

    expect(callCount.set).toBe(2);
    const recached = cacheStore.get(`user:${user.id.value}`);
    expect(recached).toBeDefined();
    if (recached) {
      expect(JSON.parse(recached)).toEqual(
        expect.objectContaining({ email: "new@example.com" }),
      );
    }
  });

  test("should return fresh data after delete mutation invalidates the cache", async () => {
    const userStore = new Map<string, User>();
    const user = createUserInStore(userStore);
    const { cache, store: cacheStore, callCount } = createInMemoryCache();
    const repo = createStoreBackedRepo(userStore);
    const { eventStore, eventBus, outboxPort, unitOfWork } =
      createMockInfrastructure();

    const queryHandler = new GetUserByIdQueryHandler(repo, cache);

    // ════════════════════════════════════════════════════════════════════
    // Step 1: Query → cache miss → populate cache
    // ════════════════════════════════════════════════════════════════════
    const result1 = await queryUser(queryHandler, user.id.value);
    expect(result1.isOk()).toBe(true);
    if (!result1.isOk()) return;
    expect(result1.value.id).toBe(user.id.value);

    expect(callCount.set).toBe(1);
    expect(cacheStore.has(`user:${user.id.value}`)).toBe(true);

    // ════════════════════════════════════════════════════════════════════
    // Step 2: Delete mutation → cache.del
    // ════════════════════════════════════════════════════════════════════
    const deleteHandler = new DeleteUserCommandHandler(
      repo,
      eventStore,
      eventBus,
      outboxPort,
      unitOfWork,
      cache,
    );

    const mutationResult = await deleteHandler.handle(
      new DeleteUserCommand(user.id.value),
    );
    expect(mutationResult.isOk()).toBe(true);

    expect(callCount.del).toBe(1);
    expect(cacheStore.has(`user:${user.id.value}`)).toBe(false);

    // ════════════════════════════════════════════════════════════════════
    // Step 3: Query again → cache miss → user soft-deleted but exists
    // ════════════════════════════════════════════════════════════════════
    const result2 = await queryUser(queryHandler, user.id.value);
    expect(result2.isOk()).toBe(true);
    if (!result2.isOk()) return;
    expect(result2.value.id).toBe(user.id.value);

    expect(callCount.set).toBe(2);
  });

  test("should return fresh data after each mutation in a multiple-mutation sequence", async () => {
    const userStore = new Map<string, User>();
    const user = createUserInStore(userStore, {
      email: "ada@example.com",
      role: "member",
    });
    const { cache, store: cacheStore, callCount } = createInMemoryCache();
    const repo = createStoreBackedRepo(userStore);
    const { eventStore, eventBus, outboxPort, unitOfWork } =
      createMockInfrastructure();

    const queryHandler = new GetUserByIdQueryHandler(repo, cache);

    // ════════════════════════════════════════════════════════════════════
    // Step 1: Query → cache miss → populate cache
    // ════════════════════════════════════════════════════════════════════
    const result1 = await queryUser(queryHandler, user.id.value);
    expect(result1.isOk()).toBe(true);
    if (!result1.isOk()) return;
    expect(result1.value.email).toBe("ada@example.com");
    expect(result1.value.role).toBe("member");

    expect(callCount.set).toBe(1);

    // ════════════════════════════════════════════════════════════════════
    // Step 2: Mutation 1 → change email → cache.del
    // ════════════════════════════════════════════════════════════════════
    const emailHandler = new ChangeUserEmailCommandHandler(
      repo,
      eventStore,
      eventBus,
      outboxPort,
      unitOfWork,
      cache,
    );

    const mutation1 = await emailHandler.handle(
      new ChangeUserEmailCommand(user.id.value, "new@example.com"),
    );
    expect(mutation1.isOk()).toBe(true);

    expect(callCount.del).toBe(1);
    expect(cacheStore.has(`user:${user.id.value}`)).toBe(false);

    // ════════════════════════════════════════════════════════════════════
    // Step 3: Query → cache miss → fresh email from repo → re-populated
    // ════════════════════════════════════════════════════════════════════
    const result2 = await queryUser(queryHandler, user.id.value);
    expect(result2.isOk()).toBe(true);
    if (!result2.isOk()) return;
    expect(result2.value.email).toBe("new@example.com");
    expect(result2.value.role).toBe("member");

    expect(callCount.set).toBe(2);
    expect(cacheStore.has(`user:${user.id.value}`)).toBe(true);

    // ════════════════════════════════════════════════════════════════════
    // Step 4: Mutation 2 → change role → cache.del
    // ════════════════════════════════════════════════════════════════════
    const roleHandler = new ChangeUserRoleCommandHandler(
      repo,
      eventStore,
      eventBus,
      outboxPort,
      unitOfWork,
      cache,
    );

    const mutation2 = await roleHandler.handle(
      new ChangeUserRoleCommand(user.id.value, "admin"),
    );
    expect(mutation2.isOk()).toBe(true);

    expect(callCount.del).toBe(2);
    expect(cacheStore.has(`user:${user.id.value}`)).toBe(false);

    // ════════════════════════════════════════════════════════════════════
    // Step 5: Query → cache miss → fresh role from repo → re-populated
    // ════════════════════════════════════════════════════════════════════
    const result3 = await queryUser(queryHandler, user.id.value);
    expect(result3.isOk()).toBe(true);
    if (!result3.isOk()) return;
    expect(result3.value.email).toBe("new@example.com");
    expect(result3.value.role).toBe("admin");

    expect(callCount.set).toBe(3);
    expect(cacheStore.has(`user:${user.id.value}`)).toBe(true);
  });
});
