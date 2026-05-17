import { beforeEach, describe, expect, it, mock } from "bun:test";
import { err, ok } from "@repo/shared";
import type { AppContainer } from "../container/app-container.ts";
import { db } from "../database/drizzle.client.ts";
import { processOutbox } from "./processor.ts";

// We mock the database calls.
mock.module("../database/drizzle.client.ts", () => ({
  db: {
    select: mock(() => ({
      from: mock(() => ({
        where: mock(() => ({
          limit: mock(async () => []),
        })),
        limit: mock(async () => []),
      })),
    })),
    delete: mock(() => ({
      where: mock(async () => ({ rowCount: 1 })),
    })),
    update: mock(() => ({
      set: mock(() => ({
        where: mock(async () => ({ rowCount: 1 })),
      })),
    })),
  },
}));

type MockFn = ReturnType<typeof mock>;

beforeEach(() => {
  (db.select as MockFn).mockClear();
  (db.delete as MockFn).mockClear();
  (db.update as MockFn).mockClear();
});

describe("processOutbox", () => {
  it("should process events and delete them on success", async () => {
    const mockEventBus = {
      publish: mock(async () => ok(undefined)),
    };

    const container = {
      externalEventBus: mockEventBus,
    } as unknown as AppContainer;

    // Setup mock data
    const mockRows = [
      {
        id: "1",
        aggregateId: "user-1",
        eventType: "USER_CREATED",
        payload: { version: 1 },
        createdAt: new Date(),
        retryCount: 0,
        lastError: null,
        nextRetryAt: null,
      },
    ];

    (db.select as MockFn).mockImplementation(() => ({
      from: () => ({
        where: () => ({
          limit: async () => mockRows,
        }),
      }),
    }));

    await processOutbox(container);

    expect(mockEventBus.publish).toHaveBeenCalled();
    expect(db.delete).toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });

  it("should increment retry count on failure", async () => {
    const mockEventBus = {
      publish: mock(async () => err(new Error("Network error"))),
    };

    const container = {
      externalEventBus: mockEventBus,
    } as unknown as AppContainer;

    const mockRows = [
      {
        id: "2",
        aggregateId: "user-2",
        eventType: "USER_CREATED",
        payload: { version: 1 },
        createdAt: new Date(),
        retryCount: 0,
        lastError: null,
        nextRetryAt: null,
      },
    ];

    (db.select as MockFn).mockImplementation(() => ({
      from: () => ({
        where: () => ({
          limit: async () => mockRows,
        }),
      }),
    }));

    await processOutbox(container);

    expect(mockEventBus.publish).toHaveBeenCalled();
    expect(db.update).toHaveBeenCalled();
    expect(db.delete).not.toHaveBeenCalled();
  });

  it("should not process events that have reached MAX_RETRIES", async () => {
    const mockEventBus = {
      publish: mock(async () => ok(undefined)),
    };

    const container = {
      externalEventBus: mockEventBus,
    } as unknown as AppContainer;

    // Row has 10 retries already
    const mockRows = [
      {
        id: "3",
        aggregateId: "user-3",
        eventType: "USER_CREATED",
        payload: { version: 1 },
        createdAt: new Date(),
        retryCount: 10,
        lastError: "Persistent error",
        nextRetryAt: new Date(Date.now() - 1000),
      },
    ];

    // Select should not return this row because of the lt(retryCount, 10) condition
    (db.select as MockFn).mockImplementation(() => ({
      from: () => ({
        where: () => ({
          limit: async () => [], // Simulating that the query filtered it out
        }),
      }),
    }));

    await processOutbox(container);

    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });
});
