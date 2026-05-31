import { afterEach, describe, expect, it, mock } from "bun:test";

// ─── Mock ioredis ──────────────────────────────────────────────────────
// No Redis service in CI (only postgres), so mock the Redis class entirely.
// The mock bridges pub/sub internally to simulate Redis Pub/Sub:
//   - publish() triggers messageHandler if one is registered
//   - on("message", ...) captures the handler for direct triggering

let rejectWith: Error | null = null;
let messageHandler:
  | ((channel: string, message: string) => Promise<void>)
  | null = null;

const mockQuit = mock(async () => {
  if (rejectWith) throw rejectWith;
  return "OK" as const;
});
const mockPublish = mock(async (_channel: string, _message: string) => 0);
const mockSubscribe = mock(async (_channel: string) => undefined);

mock.module("ioredis", () => ({
  Redis: class {
    on = mock((event: string, handler: unknown) => {
      if (event === "message") {
        messageHandler = handler as (
          channel: string,
          message: string,
        ) => Promise<void>;
      }
      return this;
    });
    publish = mockPublish;
    subscribe = mockSubscribe;
    quit = mockQuit;
  },
}));

import { RedisEventBus } from "./redis-event-bus.ts";

/** Helper: type-safe access to the captured message handler. */
function getMessageHandler(): (
  channel: string,
  message: string,
) => Promise<void> {
  return messageHandler as (channel: string, message: string) => Promise<void>;
}

describe("RedisEventBus", () => {
  const originalConsoleError = console.error;
  const originalConsoleLog = console.log;

  afterEach(() => {
    mockQuit.mockClear();
    mockPublish.mockClear();
    mockSubscribe.mockClear();
    rejectWith = null;
    messageHandler = null;
    console.error = originalConsoleError;
    console.log = originalConsoleLog;
  });

  // ─── disconnect() ────────────────────────────────────────────────────

  describe("disconnect()", () => {
    it("should call quit() on both pubClient and subClient", async () => {
      const bus = new RedisEventBus("redis://localhost:6379");

      await bus.disconnect();

      expect(mockQuit).toHaveBeenCalledTimes(2);
    });

    it("should be idempotent when called multiple times", async () => {
      const bus = new RedisEventBus("redis://localhost:6379");

      await bus.disconnect();
      await expect(bus.disconnect()).resolves.toBeUndefined();
      await expect(bus.disconnect()).resolves.toBeUndefined();

      // quit() should only be called for the first disconnect (2 clients)
      expect(mockQuit).toHaveBeenCalledTimes(2);
    });

    it("should not reject when quit() throws — logs error instead", async () => {
      const errorLogSpy = mock(() => {});
      console.error = errorLogSpy;
      rejectWith = new Error("Connection closed");

      const bus = new RedisEventBus("redis://localhost:6379");

      await expect(bus.disconnect()).resolves.toBeUndefined();

      expect(mockQuit).toHaveBeenCalledTimes(2);
      expect(errorLogSpy).toHaveBeenCalledTimes(2);
      expect(errorLogSpy).toHaveBeenCalledWith(
        "[RedisEventBus] Error during disconnect:",
        new Error("Connection closed"),
      );
    });
  });

  // ─── subscribe() + publish() ─────────────────────────────────────────

  describe("subscribe() + publish()", () => {
    it("should register handler and subscribe to Redis channel", () => {
      const bus = new RedisEventBus("redis://localhost:6379");
      const handler = mock(async () => {});

      // The first subscribe() for an eventType triggers Redis subscribe
      bus.subscribe("UserCreated", handler);

      expect(mockSubscribe).toHaveBeenCalledTimes(1);
      expect(mockSubscribe).toHaveBeenCalledWith("events:UserCreated");

      // Second subscribe for the same event type should NOT re-subscribe
      bus.subscribe(
        "UserCreated",
        mock(async () => {}),
      );
      expect(mockSubscribe).toHaveBeenCalledTimes(1);
    });

    it("should subscribe to different channels for different event types", () => {
      const bus = new RedisEventBus("redis://localhost:6379");

      bus.subscribe(
        "UserCreated",
        mock(async () => {}),
      );
      bus.subscribe(
        "UserDeleted",
        mock(async () => {}),
      );

      expect(mockSubscribe).toHaveBeenCalledTimes(2);
      expect(mockSubscribe).toHaveBeenCalledWith("events:UserCreated");
      expect(mockSubscribe).toHaveBeenCalledWith("events:UserDeleted");
    });

    it("should call pubClient.publish with serialized event", async () => {
      const bus = new RedisEventBus("redis://localhost:6379");
      const event = {
        aggregateId: "user-123",
        eventType: "UserCreated",
        occurredAt: new Date("2024-06-01T12:00:00Z"),
        version: 1,
      };

      const result = await bus.publish(event);

      expect(result.isOk()).toBe(true);
      expect(mockPublish).toHaveBeenCalledTimes(1);
      expect(mockPublish).toHaveBeenCalledWith(
        "events:UserCreated",
        JSON.stringify(event),
      );
    });

    it("should deliver event to registered handler when message arrives", async () => {
      const bus = new RedisEventBus("redis://localhost:6379");
      expect(messageHandler).not.toBeNull(); // captured from constructor

      const handler = mock(async (_event: unknown) => {});
      bus.subscribe("UserCreated", handler);

      const eventPayload = {
        aggregateId: "user-456",
        eventType: "UserCreated",
        occurredAt: "2024-06-01T12:00:00.000Z",
        version: 1,
      };
      await getMessageHandler()(
        "events:UserCreated",
        JSON.stringify(eventPayload),
      );

      expect(handler).toHaveBeenCalledTimes(1);
      interface IncomingEvent {
        aggregateId: string;
        eventType: string;
        occurredAt: Date;
        version: number;
      }
      const calledEvent = handler.mock.calls[0]?.[0] as
        | IncomingEvent
        | undefined;
      expect(calledEvent).toMatchObject({
        aggregateId: "user-456",
        eventType: "UserCreated",
        version: 1,
      });
      // occurredAt is parsed back into a Date
      expect(calledEvent?.occurredAt).toBeInstanceOf(Date);
      expect((calledEvent?.occurredAt as Date).getTime()).toBe(
        new Date("2024-06-01T12:00:00.000Z").getTime(),
      );
    });

    it("should call all handlers registered for the same event type", async () => {
      const bus = new RedisEventBus("redis://localhost:6379");
      const handler1 = mock(async () => {});
      const handler2 = mock(async () => {});

      bus.subscribe("UserCreated", handler1);
      bus.subscribe("UserCreated", handler2);

      await getMessageHandler()(
        "events:UserCreated",
        JSON.stringify({
          aggregateId: "u-1",
          eventType: "UserCreated",
          occurredAt: new Date().toISOString(),
          version: 1,
        }),
      );

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it("should not call handler for a different event type", async () => {
      const bus = new RedisEventBus("redis://localhost:6379");
      const handler = mock(async () => {});

      bus.subscribe("UserCreated", handler);

      // Trigger message for a different event type
      await getMessageHandler()(
        "events:UserDeleted",
        JSON.stringify({
          aggregateId: "u-2",
          eventType: "UserDeleted",
          occurredAt: new Date().toISOString(),
          version: 1,
        }),
      );

      expect(handler).not.toHaveBeenCalled();
    });

    it("should publishAll and deliver events to all subscribers", async () => {
      const bus = new RedisEventBus("redis://localhost:6379");
      const createHandler = mock(async () => {});
      const deleteHandler = mock(async () => {});

      bus.subscribe("UserCreated", createHandler);
      bus.subscribe("UserDeleted", deleteHandler);

      // Publish multiple events
      const createdEvent = {
        aggregateId: "u-3",
        eventType: "UserCreated",
        occurredAt: new Date("2024-06-01T12:00:00Z"),
        version: 1,
      };
      const deletedEvent = {
        aggregateId: "u-3",
        eventType: "UserDeleted",
        occurredAt: new Date("2024-06-01T13:00:00Z"),
        version: 2,
      };

      const result = await bus.publishAll([createdEvent, deletedEvent]);
      expect(result.isOk()).toBe(true);

      // Verify both events were published via pubClient
      expect(mockPublish).toHaveBeenCalledTimes(2);
      expect(mockPublish).toHaveBeenCalledWith(
        "events:UserCreated",
        JSON.stringify(createdEvent),
      );
      expect(mockPublish).toHaveBeenCalledWith(
        "events:UserDeleted",
        JSON.stringify(deletedEvent),
      );

      // Deliver each event via the message handler
      await getMessageHandler()(
        "events:UserCreated",
        JSON.stringify({
          aggregateId: createdEvent.aggregateId,
          eventType: createdEvent.eventType,
          occurredAt: createdEvent.occurredAt.toISOString(),
          version: createdEvent.version,
        }),
      );
      await getMessageHandler()(
        "events:UserDeleted",
        JSON.stringify({
          aggregateId: deletedEvent.aggregateId,
          eventType: deletedEvent.eventType,
          occurredAt: deletedEvent.occurredAt.toISOString(),
          version: deletedEvent.version,
        }),
      );

      expect(createHandler).toHaveBeenCalledTimes(1);
      expect(deleteHandler).toHaveBeenCalledTimes(1);
    });
  });
});
