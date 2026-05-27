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
import { isErr } from "@repo/shared";

// Mock database module to avoid needing a real PostgreSQL connection.
// The mock provides a minimal Drizzle-like db object that all infrastructure
// classes (repositories, event store, outbox, unit of work) use internally.
mock.module("../database/drizzle.client.ts", () => ({
  db: {
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
  },
}));

// ─── Mock for RedisEventBus ─────────────────────────────────────────────
// Used by disconnect lifecycle tests to verify duck-type check logic.
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

import { createAppContainer } from "./app-container.ts";

describe("createAppContainer", () => {
  // ─── Structure ───────────────────────────────────────────────────────

  it("should return a container with all 6 required properties", () => {
    const container = createAppContainer();

    expect(container.commandBus).toBeDefined();
    expect(container.queryBus).toBeDefined();
    expect(container.eventBus).toBeDefined();
    expect(container.externalEventBus).toBeDefined();
    expect(container.unitOfWork).toBeDefined();
    expect(container.disconnect).toBeFunction();
  });

  it("should use InMemoryEventBus in test environment", () => {
    const container = createAppContainer();
    // InMemoryEventBus has subscribe/publish/publishAll methods
    expect(container.eventBus.subscribe).toBeFunction();
    expect(container.eventBus.publish).toBeFunction();
    expect(container.eventBus.publishAll).toBeFunction();
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

  describe("disconnect lifecycle", () => {
    describe("duck-type check logic", () => {
      it("should be a no-op when object lacks disconnect method", async () => {
        let called = false;
        const bus = {} as { disconnect?: () => Promise<void> };
        if (typeof bus.disconnect === "function") {
          await bus.disconnect();
          called = true;
        }
        expect(called).toBe(false);
      });

      it("should call disconnect when object has disconnect method", async () => {
        const spy = mock(async () => {});
        const bus = { disconnect: spy } as { disconnect?: () => Promise<void> };
        if (typeof bus.disconnect === "function") {
          await bus.disconnect();
        }
        expect(spy).toHaveBeenCalledTimes(1);
      });
    });

    describe("container integration", () => {
      beforeEach(() => {
        mockDisconnect.mockReset();
      });

      afterEach(() => {
        process.env.NODE_ENV = "test";
      });

      it("should be a no-op when eventBus has no disconnect method (InMemoryEventBus)", async () => {
        // In test mode createAppContainer uses InMemoryEventBus, which does
        // not have a disconnect() method — the duck-type check skips it.
        const container = createAppContainer();
        await expect(container.disconnect()).resolves.toBeUndefined();
      });

      it("should call disconnect when eventBus has disconnect method (RedisEventBus)", async () => {
        // Temporarily switch to non-test mode so the factory creates RedisEventBus
        process.env.NODE_ENV = "development";
        const container = createAppContainer();
        await container.disconnect();
        expect(mockDisconnect).toHaveBeenCalledTimes(1);
      });
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
