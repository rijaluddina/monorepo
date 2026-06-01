import { describe, expect, it, mock } from "bun:test";
import { Email, UniqueId, User, UserName } from "@repo/domain";
import { AppError, NotFoundError, err, ok } from "@repo/shared";
import type { ICache } from "../../shared/cache.port.ts";
import type { IUserRepository } from "../ports/user-repository.port.ts";
import { GetUserByIdQueryHandler } from "./get-user-by-id.handler.ts";
import { GetUserByIdQuery } from "./get-user-by-id.query.ts";

// ─── Helpers ──────────────────────────────────────────────────────────

function createTestUser(id?: string): User {
  const uniqueId = id ? new UniqueId(id) : new UniqueId();
  return User.reconstitute(
    {
      name: UserName.create("Ada", "Lovelace").unwrap(),
      email: Email.create("ada@example.com").unwrap(),
      role: "member",
      isActive: true,
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-01"),
    },
    uniqueId,
    1,
  );
}

interface MockCache extends ICache {
  callCount: { get: number; set: number; del: number };
  getKeys: string[];
  setKeys: string[];
  delKeys: string[];
  setArgs: { key: string; value: unknown; ttl?: number }[];
}

function createMockCache(): MockCache {
  const store = new Map<string, string>();

  return {
    callCount: { get: 0, set: 0, del: 0 },
    getKeys: [],
    setKeys: [],
    delKeys: [],
    setArgs: [],

    async get<T>(key: string): Promise<T | undefined> {
      this.callCount.get++;
      this.getKeys.push(key);
      const raw = store.get(key);
      if (raw === undefined) return undefined;
      return JSON.parse(raw) as T;
    },

    async set(key: string, value: unknown, ttl?: number): Promise<void> {
      this.callCount.set++;
      this.setKeys.push(key);
      this.setArgs.push({ key, value, ttl });
      store.set(key, JSON.stringify(value));
    },

    async del(key: string): Promise<void> {
      this.callCount.del++;
      this.delKeys.push(key);
      store.delete(key);
    },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────

describe("GetUserByIdQueryHandler — cache integration", () => {
  it("should miss cache, fetch from repository, populate cache, and return user", async () => {
    const user = createTestUser("u-cache-miss");
    const mockRepo: IUserRepository = {
      findById: mock(async () => ok(user)),
      findByEmail: mock(),
      findAll: mock(),
      save: mock(),
      delete: mock(),
      existsByEmail: mock(),
    } as unknown as IUserRepository;

    const cache = createMockCache();
    const handler = new GetUserByIdQueryHandler(mockRepo, cache);
    const query = new GetUserByIdQuery(user.id.value);

    const result = await handler.handle(query);

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;
    expect(result.value.id).toBe(user.id.value);
    expect(result.value.firstName).toBe("Ada");
    expect(result.value.email).toBe("ada@example.com");
    expect(mockRepo.findById).toHaveBeenCalledTimes(1);
    expect(cache.callCount.set).toBe(1);
    expect(cache.setArgs[0]).toEqual({
      key: `user:${user.id.value}`,
      value: expect.objectContaining({ id: user.id.value }),
      ttl: 60,
    });
  });

  it("should serve cached result on second call without hitting repository", async () => {
    const user = createTestUser("u-cache-hit");
    const mockRepo: IUserRepository = {
      findById: mock(async () => ok(user)),
      findByEmail: mock(),
      findAll: mock(),
      save: mock(),
      delete: mock(),
      existsByEmail: mock(),
    } as unknown as IUserRepository;

    const cache = createMockCache();
    const handler = new GetUserByIdQueryHandler(mockRepo, cache);
    const query = new GetUserByIdQuery(user.id.value);

    // First call: cache miss
    const result1 = await handler.handle(query);
    expect(result1.isOk()).toBe(true);
    expect(mockRepo.findById).toHaveBeenCalledTimes(1);

    // Second call: cache hit — repository should NOT be called
    const result2 = await handler.handle(query);
    expect(result2.isOk()).toBe(true);
    if (!result2.isOk()) return;
    expect(result2.value.id).toBe(user.id.value);
    expect(mockRepo.findById).toHaveBeenCalledTimes(1); // still 1 — not incremented
  });

  it("should return NotFoundError and NOT cache when user does not exist", async () => {
    const userId = "u-not-found";
    const mockRepo: IUserRepository = {
      findById: mock(async () => ok(undefined)),
      findByEmail: mock(),
      findAll: mock(),
      save: mock(),
      delete: mock(),
      existsByEmail: mock(),
    } as unknown as IUserRepository;

    const cache = createMockCache();
    const handler = new GetUserByIdQueryHandler(mockRepo, cache);
    const query = new GetUserByIdQuery(userId);

    const result = await handler.handle(query);

    expect(result.isErr()).toBe(true);
    if (!result.isErr()) return;
    expect(result.error).toBeInstanceOf(NotFoundError);
    expect(cache.callCount.set).toBe(0); // cache NOT populated
  });

  it("should propagate repository error and NOT cache the result", async () => {
    const userId = "u-db-error";
    const dbError = new AppError("Database connection lost", "DB_ERROR");
    const mockRepo: IUserRepository = {
      findById: mock(async () => err(dbError)),
      findByEmail: mock(),
      findAll: mock(),
      save: mock(),
      delete: mock(),
      existsByEmail: mock(),
    } as unknown as IUserRepository;

    const cache = createMockCache();
    const handler = new GetUserByIdQueryHandler(mockRepo, cache);
    const query = new GetUserByIdQuery(userId);

    const result = await handler.handle(query);

    expect(result.isErr()).toBe(true);
    if (!result.isErr()) return;
    expect(result.error).toBe(dbError);
    expect(cache.callCount.set).toBe(0); // cache NOT populated
  });

  it("should maintain separate cache entries for different user IDs", async () => {
    const user1 = createTestUser("u-separate-1");
    const user2 = createTestUser("u-separate-2");
    const mockRepo: IUserRepository = {
      findById: mock(async (id: string) => {
        if (id === user1.id.value) return ok(user1);
        if (id === user2.id.value) return ok(user2);
        return ok(undefined);
      }),
      findByEmail: mock(),
      findAll: mock(),
      save: mock(),
      delete: mock(),
      existsByEmail: mock(),
    } as unknown as IUserRepository;

    const cache = createMockCache();
    const handler = new GetUserByIdQueryHandler(mockRepo, cache);

    // First call for user1 — cache miss
    await handler.handle(new GetUserByIdQuery(user1.id.value));
    expect(mockRepo.findById).toHaveBeenCalledTimes(1);

    // First call for user2 — cache miss (different key)
    await handler.handle(new GetUserByIdQuery(user2.id.value));
    expect(mockRepo.findById).toHaveBeenCalledTimes(2);

    // Second call for user1 — cache hit
    const r1 = await handler.handle(new GetUserByIdQuery(user1.id.value));
    expect(r1.isOk()).toBe(true);
    if (!r1.isOk()) return;
    expect(r1.value.id).toBe(user1.id.value);

    // Second call for user2 — cache hit
    const r2 = await handler.handle(new GetUserByIdQuery(user2.id.value));
    expect(r2.isOk()).toBe(true);
    if (!r2.isOk()) return;
    expect(r2.value.id).toBe(user2.id.value);

    // Repository still called only 2 times (once per unique ID)
    expect(mockRepo.findById).toHaveBeenCalledTimes(2);
  });
});
