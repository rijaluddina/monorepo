import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import {
  ActivateUserCommand,
  ChangeUserEmailCommand,
  ChangeUserRoleCommand,
  CreateUserCommand,
  DeactivateUserCommand,
  DeleteUserCommand,
  GetUserByIdQuery,
  GetUsersQuery,
  RestoreUserCommand,
} from "@repo/application";
import { type IDisposable, isErr } from "@repo/shared";
import { MockDisposable, MockLogger } from "@repo/shared/testing";

// ─── Mock helpers for dispose lifecycle tests ────────────────────────────
// Note: stopOutboxProcessor uses real function (no-op when not started).
// mock.module should NOT be used for ../outbox/processor.ts as it is
// process-wide and would break processor.test.ts.
const mockPoolEnd = mock(async () => {});

// Shared mock DB object that getDb() will return.
const mockDb = {
  query: {
    users: {
      findFirst: mock(async () => undefined),
      findMany: mock(async () => []),
    },
    eventStore: {
      findMany: mock(async () => []),
    },
  },
  select: mock(() => ({
    from: mock(() => ({
      where: mock(() => ({
        limit: mock(async () => [{ value: 0 }]),
      })),
    })),
  })),
  insert: mock(() => ({
    values: mock(async () => ({ rowCount: 1 })),
  })),
  update: mock(() => ({
    set: mock(() => ({
      where: mock(async () => ({ rowCount: 1 })),
    })),
  })),
  delete: mock(() => ({
    where: mock(async () => ({ rowCount: 1 })),
  })),
  transaction: mock(async (fn: (tx: Record<string, unknown>) => unknown) => {
    const tx = {
      query: {
        users: {
          findFirst: mock(async () => undefined),
          findMany: mock(async () => []),
        },
        eventStore: {
          findMany: mock(async () => []),
        },
      },
      insert: mock(() => ({
        values: mock(async () => ({ rowCount: 1 })),
      })),
      update: mock(() => ({
        set: mock(() => ({
          where: mock(async () => ({ rowCount: 1 })),
        })),
      })),
    };
    return fn(tx);
  }),
};

// Mock database module to avoid needing a real PostgreSQL connection.
mock.module("../database/drizzle.client.ts", () => ({
  getDb: () => mockDb,
  getPool: () => ({
    end: mockPoolEnd,
    totalCount: 0,
    idleCount: 0,
    waitingCount: 0,
  }),
}));

// ─── Mock for RedisEventBus ─────────────────────────────────────────────
// Used by disconnect lifecycle tests to verify IDisposable array pattern.
// Only instantiated when NODE_ENV != "test" — safe to mock at module level
// since existing tests run in test mode (InMemoryEventBus).
const mockDisconnect = mock(async () => {});
mock.module("../bus/redis-event-bus.ts", () => ({
  RedisEventBus: class {
    disconnect = mockDisconnect;
    subscribe(_eventType: string, _handler: unknown) {}
    async publish(_event: unknown) {
      return {
        ok: true as const,
        isOk: () => true,
        isErr: () => false,
        value: undefined,
      };
    }
    async publishAll(_events: unknown) {
      return {
        ok: true as const,
        isOk: () => true,
        isErr: () => false,
        value: undefined,
      };
    }
  },
}));

// ─── Mock for Redis clients ─────────────────────────────────────────────
// Prevents real Redis connections in non-test disconnect tests.
// getRedisClients() is only called when NODE_ENV != "test".
// The mocked RedisEventBus constructor ignores the clients entirely.
mock.module("../redis/redis.client.ts", () => ({
  getRedisClients: () => ({
    pubClient: { on: () => {} } as never,
    subClient: { on: () => {} } as never,
  }),
}));

import { createAppContainer } from "./app-container.ts";

describe("createAppContainer", () => {
  // ─── Structure ───────────────────────────────────────────────────────

  it("should return a container with all 7 required properties", () => {
    const container = createAppContainer();

    expect(container.commandBus).toBeDefined();
    expect(container.queryBus).toBeDefined();
    expect(container.eventBus).toBeDefined();
    expect(container.externalEventBus).toBeDefined();
    expect(container.unitOfWork).toBeDefined();
    expect(container.disconnect).toBeFunction();
    expect(container.registerDisposable).toBeFunction();
  });

  it("should use InMemoryEventBus for internal event bus in test environment", () => {
    const container = createAppContainer();
    // eventBus is always InMemoryEventBus
    expect(container.eventBus.subscribe).toBeFunction();
    expect(container.eventBus.publish).toBeFunction();
    expect(container.eventBus.publishAll).toBeFunction();

    // externalEventBus is also InMemoryEventBus in test mode
    expect(container.externalEventBus.subscribe).toBeFunction();
    expect(container.externalEventBus.publish).toBeFunction();
  });

  it("should not throw on construction (no duplicate handler registrations)", () => {
    // InMemoryCommandBus and InMemoryQueryBus throw on duplicate
    // registration. If createAppContainer() succeeds without throwing,
    // all 7 commands and 2 queries are uniquely registered.
    expect(() => createAppContainer()).not.toThrow();
  });

  // ─── Command handler registrations ───────────────────────────────────

  describe("command handler registration", () => {
    it("should route CreateUserCommand to its handler", async () => {
      const container = createAppContainer();
      const result = await container.commandBus.dispatch(
        new CreateUserCommand(
          "John",
          "Doe",
          `create-${Date.now()}@example.com`,
        ),
      );
      // Should NOT get NO_HANDLER — the handler exists and is registered.
      // With the mock DB, this flow may even succeed end-to-end.
      if (isErr(result)) {
        expect(result.error.code).not.toBe("NO_HANDLER");
      }
    });

    it("should route ActivateUserCommand to its handler", async () => {
      const container = createAppContainer();
      const result = await container.commandBus.dispatch(
        new ActivateUserCommand("00000000-0000-0000-0000-000000000000"),
      );
      if (isErr(result)) {
        expect(result.error.code).not.toBe("NO_HANDLER");
      }
    });

    it("should route DeactivateUserCommand to its handler", async () => {
      const container = createAppContainer();
      const result = await container.commandBus.dispatch(
        new DeactivateUserCommand("00000000-0000-0000-0000-000000000000"),
      );
      if (isErr(result)) {
        expect(result.error.code).not.toBe("NO_HANDLER");
      }
    });

    it("should route ChangeUserEmailCommand to its handler", async () => {
      const container = createAppContainer();
      const result = await container.commandBus.dispatch(
        new ChangeUserEmailCommand(
          "00000000-0000-0000-0000-000000000000",
          "test@example.com",
        ),
      );
      if (isErr(result)) {
        expect(result.error.code).not.toBe("NO_HANDLER");
      }
    });

    it("should route ChangeUserRoleCommand to its handler", async () => {
      const container = createAppContainer();
      const result = await container.commandBus.dispatch(
        new ChangeUserRoleCommand(
          "00000000-0000-0000-0000-000000000000",
          "admin",
        ),
      );
      if (isErr(result)) {
        expect(result.error.code).not.toBe("NO_HANDLER");
      }
    });

    it("should route DeleteUserCommand to its handler", async () => {
      const container = createAppContainer();
      const result = await container.commandBus.dispatch(
        new DeleteUserCommand("00000000-0000-0000-0000-000000000000"),
      );
      if (isErr(result)) {
        expect(result.error.code).not.toBe("NO_HANDLER");
      }
    });

    it("should route RestoreUserCommand to its handler", async () => {
      const container = createAppContainer();
      const result = await container.commandBus.dispatch(
        new RestoreUserCommand("00000000-0000-0000-0000-000000000000"),
      );
      if (isErr(result)) {
        expect(result.error.code).not.toBe("NO_HANDLER");
      }
    });

    it("should return NO_HANDLER for unregistered command", async () => {
      const container = createAppContainer();
      const unknownCommand = { _type: "Command" as const };
      const result = await container.commandBus.dispatch(
        unknownCommand as never,
      );
      expect(result.isErr()).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe("NO_HANDLER");
      }
    });
  });

  // ─── Disconnect lifecycle ────────────────────────────────────────────
  //
  // The container collects IDisposable resources into an array and iterates
  // them in disconnect(). The disposables are cleaned in this order:
  //   1. Externally registered (via registerDisposable — e.g. HTTP server)
  //   2. Outbox processor (real stopOutboxProcessor — no-op when not started)
  //   3. RedisEventBus (externalEventBus, when NODE_ENV != "test")
  //   4. Database pool (via pool.end(), mocked as mockPoolEnd)
  // Outbox and pool are always registered; RedisEventBus only in non-test.
  //
  // Note: stopOutboxProcessor is NOT mocked (would break processor.test.ts
  // via process-wide Bun mock.module). It's a safe no-op when not started.

  describe("disconnect lifecycle", () => {
    beforeEach(() => {
      mockDisconnect.mockReset();
      mockPoolEnd.mockReset();
      process.env.NODE_ENV = "test";
    });

    afterEach(() => {
      process.env.NODE_ENV = "test";
    });

    it("should call pool.end and skip RedisEventBus in test mode", async () => {
      // In test mode: both eventBus and externalEventBus are InMemoryEventBus
      // (no disconnect). Only pool.end is called.
      const container = createAppContainer();
      await container.disconnect();

      expect(mockPoolEnd).toHaveBeenCalledTimes(1);
      expect(mockDisconnect).not.toHaveBeenCalled();
    });

    it("should call externalEventBus.disconnect (RedisEventBus) in non-test mode", async () => {
      // In non-test mode: externalEventBus is RedisEventBus (mocked).
      // eventBus is always InMemoryEventBus (no disconnect).
      process.env.NODE_ENV = "development";
      const container = createAppContainer();
      await container.disconnect();

      // RedisEventBus.disconnect() called exactly once (externalEventBus)
      expect(mockDisconnect).toHaveBeenCalledTimes(1);
      expect(mockPoolEnd).toHaveBeenCalledTimes(1);
    });

    it("should call externally registered disposables via registerDisposable", async () => {
      const server = new MockDisposable();
      const container = createAppContainer();
      container.registerDisposable(server);

      await container.disconnect();

      // External disposable (server stop) is called
      expect(server.callCount).toBe(1);
      // Internal disposables are also still called
      expect(mockPoolEnd).toHaveBeenCalledTimes(1);
    });

    it("should run externally registered disposables FIRST (unshift)", async () => {
      // Verify ordering: external (server stop) runs before internal
      const callOrder: string[] = [];
      const stopServer = mock(async () => {
        callOrder.push("server");
      });

      // Override mockPoolEnd to record its position in call order
      mockPoolEnd.mockImplementation(async () => {
        callOrder.push("pool");
      });

      const container = createAppContainer();
      container.registerDisposable({ disconnect: stopServer });

      await container.disconnect();

      expect(callOrder).toEqual(["server", "pool"]);
    });

    it("should collect errors and return them when a disposable fails", async () => {
      // Make pool.end() throw — disconnect() must still resolve
      // and subsequent/non-throwing disposables must still be called.
      const poolError = new Error("Pool connection lost");
      mockPoolEnd.mockRejectedValueOnce(poolError);

      const logger = new MockLogger();
      const container = createAppContainer(undefined, logger);
      const result = await container.disconnect();

      // Errors array contains the pool error
      expect(result).toBeInstanceOf(AggregateError);
      const errors = (result as AggregateError).errors;
      expect(errors).toHaveLength(1);
      expect(errors[0]).toBe(poolError);

      // stopOutboxProcessor logs one info call + pool error is logged
      expect(logger.callCount).toBe(2);
      expect(logger.calls[0]).toEqual(["[Outbox] Worker stopped."]);
      expect((logger.calls[1] as unknown[])[0]).toBe(
        "Disconnect error [database pool]:",
      );
      expect((logger.calls[1] as unknown[])[1]).toBe(poolError);
    });

    it("should return an empty errors array when all disposables succeed", async () => {
      const container = createAppContainer();
      const result = await container.disconnect();

      expect(result).toBeInstanceOf(AggregateError);
      const errors = (result as AggregateError).errors;
      expect(errors).toEqual([]);
    });

    it("should collect all errors and continue cleanup when a middle disposable throws", async () => {
      // Make externalEventBus.disconnect() throw — pool.end() must still run.
      const busError = new Error("Redis connection timeout");
      mockDisconnect.mockRejectedValueOnce(busError);

      const logger = new MockLogger();
      process.env.NODE_ENV = "development";
      const container = createAppContainer(undefined, logger);
      const result = await container.disconnect();

      // Error was logged and collected — one disposable's failure
      // does not crash shutdown or prevent other cleanup.
      expect(result).toBeInstanceOf(AggregateError);
      const errors = (result as AggregateError).errors;
      expect(errors).toHaveLength(1);
      expect(errors[0]).toBe(busError);

      // Note: externalEventBus is unnamed in the mocked RedisEventBus,
      // so the label is "unknown".
      expect(logger.callCount).toBe(2);
      // calls[0] = externalEventBus disconnect error
      expect((logger.calls[0] as unknown[])[0]).toBe(
        "Disconnect error [unknown]:",
      );
      expect((logger.calls[0] as unknown[])[1]).toBe(busError);
      // calls[1] = outbox "Worker stopped."
      expect((logger.calls[1] as unknown[])[0]).toBe(
        "[Outbox] Worker stopped.",
      );

      // Pool still disconnected despite Redis bus failure
      expect(mockPoolEnd).toHaveBeenCalledTimes(1);
    });

    it("should timeout when a disposable hangs and continue to the next resource", async () => {
      // A disposable that never resolves must not block shutdown forever.
      const hangingDisposable: IDisposable = {
        disconnect: () => new Promise<void>(() => {}), // never settles
      };

      const logger = new MockLogger();
      const container = createAppContainer(undefined, logger, 50); // 50ms timeout
      container.registerDisposable(hangingDisposable);

      // Use a real timeout here so the test doesn't hang.
      const result = await Promise.race([
        container.disconnect(),
        new Promise<never>((_, reject) =>
          setTimeout(
            () =>
              reject(new Error("Test timeout — disconnect hung indefinitely")),
            5000,
          ),
        ),
      ]);

      expect(result).toBeInstanceOf(AggregateError);
      const errors = (result as AggregateError).errors;

      // Hanging disposable timed out (no name → "unknown")
      expect(errors).toHaveLength(1);
      // Order: hanging (timeout error) → outbox (info) → pool
      expect(logger.callCount).toBe(2);
      expect((errors[0] as Error).message).toContain(
        "Disconnect timed out after 50ms",
      );
      // calls[0] = timeout error from hanging disposable
      expect((logger.calls[0] as unknown[])[0]).toBe(
        "Disconnect error [unknown]:",
      );
      expect(((logger.calls[0] as unknown[])[1] as Error).message).toContain(
        "Disconnect timed out after 50ms",
      );
      // calls[1] = info from outbox
      expect((logger.calls[1] as unknown[])[0]).toBe(
        "[Outbox] Worker stopped.",
      );

      // Non-hanging disposables (pool) still ran
      expect(mockPoolEnd).toHaveBeenCalledTimes(1);
    });

    it("should apply configurable timeout per resource", async () => {
      // Quick timeout should fire fast, short timeout = 10ms
      const hangingDisposable: IDisposable = {
        disconnect: () => new Promise<void>(() => {}), // never settles
      };

      const logger = new MockLogger();
      const container = createAppContainer(undefined, logger, 10);
      container.registerDisposable(hangingDisposable);

      const result = await Promise.race([
        container.disconnect(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Test timeout")), 5000),
        ),
      ]);

      expect(result).toBeInstanceOf(AggregateError);
      const errors = (result as AggregateError).errors;

      expect(errors).toHaveLength(1);
      expect((errors[0] as Error).message).toContain(
        "Disconnect timed out after 10ms",
      );

      // Pool still disconnected despite timeout
      expect(mockPoolEnd).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Query handler registrations ─────────────────────────────────────

  describe("query handler registration", () => {
    it("should route GetUsersQuery to its handler", async () => {
      const container = createAppContainer();
      const result = await container.queryBus.ask(new GetUsersQuery(1, 10));
      // GetUsersQuery should succeed with mock DB (empty users list)
      expect(result.isOk()).toBe(true);
    });

    it("should route GetUserByIdQuery to its handler", async () => {
      const container = createAppContainer();
      const result = await container.queryBus.ask(
        new GetUserByIdQuery("00000000-0000-0000-0000-000000000000"),
      );
      if (isErr(result)) {
        expect(result.error.code).not.toBe("NO_HANDLER");
      }
    });

    it("should return NO_HANDLER for unregistered query", async () => {
      const container = createAppContainer();
      const unknownQuery = { _type: "Query" as const };
      const result = await container.queryBus.ask(unknownQuery as never);
      expect(result.isErr()).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe("NO_HANDLER");
      }
    });
  });
});
