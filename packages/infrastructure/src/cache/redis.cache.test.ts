import { afterEach, describe, expect, it, mock } from "bun:test";

// ─── Mock Redis pubClient ─────────────────────────────────────────────
// We mock getRedisClients() at the module level so RedisCache uses our
// fake pubClient without needing a real Redis connection or mock.module.

interface MockPubClient {
  get: ReturnType<typeof mock>;
  setex: ReturnType<typeof mock>;
  del: ReturnType<typeof mock>;
}

function createMockPubClient(): MockPubClient {
  return {
    get: mock(async (_key: string) => null),
    setex: mock(async (_key: string, _ttl: number, _value: string) => "OK"),
    del: mock(async (_key: string) => 1),
  };
}

// Create a fresh mock client per module-level evaluation
const mockPubClient = createMockPubClient();

mock.module("../redis/redis.client.ts", () => ({
  getRedisClients: () => ({
    pubClient: mockPubClient,
  }),
}));

import { RedisCache } from "./redis.cache.ts";

// ─── No-op logger for error-handling tests ────────────────────────────
// Prevents ConsoleLogger (default) from writing to console.error during
// tests that intentionally trigger Redis errors. The log-spy tests have
// their own mock loggers and verify the output explicitly.
const noopLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

describe("RedisCache", () => {
  afterEach(() => {
    // Reset call history between tests while keeping mock.module active
    mockPubClient.get.mockReset();
    mockPubClient.setex.mockReset();
    mockPubClient.del.mockReset();
    // Restore default resolved values
    mockPubClient.get.mockResolvedValue(null);
    mockPubClient.setex.mockResolvedValue("OK");
    mockPubClient.del.mockResolvedValue(1);
  });

  // ─── get() ───────────────────────────────────────────────────────────

  describe("get()", () => {
    it("should return undefined when key does not exist", async () => {
      const cache = new RedisCache();

      const result = await cache.get("missing-key");

      expect(result).toBeUndefined();
      expect(mockPubClient.get).toHaveBeenCalledWith("missing-key");
    });

    it("should return parsed JSON when key exists", async () => {
      const userDTO = { id: "u-1", firstName: "Ada" };
      mockPubClient.get.mockResolvedValue(JSON.stringify(userDTO));
      const cache = new RedisCache();

      const result = await cache.get<{ id: string; firstName: string }>(
        "user:u-1",
      );

      expect(result).toEqual(userDTO);
      expect(mockPubClient.get).toHaveBeenCalledWith("user:u-1");
    });

    it("should return undefined when Redis returns null", async () => {
      mockPubClient.get.mockResolvedValue(null);
      const cache = new RedisCache();

      const result = await cache.get("empty-key");

      expect(result).toBeUndefined();
    });

    it("should return undefined on Redis error (best-effort, not reject)", async () => {
      mockPubClient.get.mockRejectedValue(new Error("Connection refused"));
      const cache = new RedisCache(noopLogger);

      const result = await cache.get("error-key");

      expect(result).toBeUndefined();
      // Error is caught internally, not propagated
    });

    it("should return undefined on JSON parse error (best-effort, not reject)", async () => {
      mockPubClient.get.mockResolvedValue("{invalid-json");
      const cache = new RedisCache(noopLogger);

      const result = await cache.get<unknown>("bad-json");

      expect(result).toBeUndefined();
    });

    it("should log errors when debug logger is provided", async () => {
      const logSpy = mock(() => {});
      const logger = {
        debug: logSpy,
        info: mock(() => {}),
        warn: mock(() => {}),
        error: logSpy,
      };
      const redisError = new Error("Connection refused");
      mockPubClient.get.mockRejectedValue(redisError);
      const cache = new RedisCache(logger);

      await cache.get("error-key");

      expect(logSpy).toHaveBeenCalledWith(
        "[RedisCache] GET error:",
        redisError,
      );
    });
  });

  // ─── set() ───────────────────────────────────────────────────────────

  describe("set()", () => {
    it("should store value with default TTL (60s)", async () => {
      const cache = new RedisCache();
      const value = { id: "u-1", name: "Ada" };

      await cache.set("user:u-1", value);

      expect(mockPubClient.setex).toHaveBeenCalledWith(
        "user:u-1",
        60,
        JSON.stringify(value),
      );
    });

    it("should store value with custom TTL", async () => {
      const cache = new RedisCache();
      const value = { id: "u-2" };

      await cache.set("user:u-2", value, 120);

      expect(mockPubClient.setex).toHaveBeenCalledWith(
        "user:u-2",
        120,
        JSON.stringify(value),
      );
    });

    it("should not reject on Redis error (best-effort)", async () => {
      mockPubClient.setex.mockRejectedValue(new Error("Redis down"));
      const cache = new RedisCache(noopLogger);

      await expect(cache.set("key", "value")).resolves.toBeUndefined();
    });

    it("should log errors when logger is provided", async () => {
      const logSpy = mock(() => {});
      const logger = {
        debug: mock(() => {}),
        info: mock(() => {}),
        warn: mock(() => {}),
        error: logSpy,
      };
      const redisError = new Error("SET failed");
      mockPubClient.setex.mockRejectedValue(redisError);
      const cache = new RedisCache(logger);

      await cache.set("key", "value");

      expect(logSpy).toHaveBeenCalledWith(
        "[RedisCache] SET error:",
        redisError,
      );
    });
  });

  // ─── del() ───────────────────────────────────────────────────────────

  describe("del()", () => {
    it("should delete value by key", async () => {
      const cache = new RedisCache();

      await cache.del("user:u-1");

      expect(mockPubClient.del).toHaveBeenCalledWith("user:u-1");
    });

    it("should not reject on Redis error (best-effort)", async () => {
      mockPubClient.del.mockRejectedValue(new Error("Redis down"));
      const cache = new RedisCache(noopLogger);

      await expect(cache.del("key")).resolves.toBeUndefined();
    });

    it("should log errors when logger is provided", async () => {
      const logSpy = mock(() => {});
      const logger = {
        debug: mock(() => {}),
        info: mock(() => {}),
        warn: mock(() => {}),
        error: logSpy,
      };
      const redisError = new Error("DEL failed");
      mockPubClient.del.mockRejectedValue(redisError);
      const cache = new RedisCache(logger);

      await cache.del("key");

      expect(logSpy).toHaveBeenCalledWith(
        "[RedisCache] DEL error:",
        redisError,
      );
    });
  });

  // ─── Serialization edge cases ────────────────────────────────────────

  describe("serialization", () => {
    it("should handle string values without extra wrapping", async () => {
      const cache = new RedisCache();

      await cache.set("key", "plain-string");

      expect(mockPubClient.setex).toHaveBeenCalledWith(
        "key",
        60,
        '"plain-string"', // JSON.stringify wraps strings in double quotes
      );
    });

    it("should handle numeric values", async () => {
      mockPubClient.get.mockResolvedValue("42");
      const cache = new RedisCache();

      const result = await cache.get<number>("num-key");

      expect(result).toBe(42);
    });

    it("should handle array values", async () => {
      const arr = [1, 2, 3];
      mockPubClient.get.mockResolvedValue(JSON.stringify(arr));
      const cache = new RedisCache();

      const result = await cache.get<number[]>("arr-key");

      expect(result).toEqual(arr);
    });

    it("should handle null JSON value as null", async () => {
      mockPubClient.get.mockResolvedValue("null");
      const cache = new RedisCache();

      const result = await cache.get("null-key");

      // JSON.parse("null") returns null — this is valid but unlikely in practice
      expect(result).toBeNull();
    });
  });

  // ─── Constructor ─────────────────────────────────────────────────────

  describe("constructor", () => {
    it("should use ConsoleLogger when no logger is provided", async () => {
      // Just verify no error is thrown — ConsoleLogger is the default
      const cache = new RedisCache();
      expect(cache).toBeInstanceOf(RedisCache);
    });

    it("should accept a custom logger", async () => {
      const mockLogger = {
        debug: mock(() => {}),
        info: mock(() => {}),
        warn: mock(() => {}),
        error: mock(() => {}),
      };
      const cache = new RedisCache(mockLogger);

      // Trigger a get error to verify the custom logger is used
      mockPubClient.get.mockRejectedValue(new Error("fail"));
      await cache.get("key");

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
});
