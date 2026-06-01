import { afterEach, describe, expect, it, mock } from "bun:test";
import { RedisEventBus } from "./redis-event-bus.ts";

// ─── Mock client factory ──────────────────────────────────────────────
// Creates lightweight mock objects that satisfy the Redis interface
// methods used by RedisEventBus. Clients are passed directly to the
// constructor via dependency injection — no mock.module needed.

type EventHandler = (channel: string, message: string) => Promise<void>;

interface MockRedisClient {
  on: ReturnType<typeof mock>;
  publish: ReturnType<typeof mock>;
  subscribe: ReturnType<typeof mock>;
  quit: ReturnType<typeof mock>;
  /** Captured "message" handler registered via on("message", ...). */
  getMessageHandler: () => EventHandler | undefined;
}

function createMockClient(): MockRedisClient {
  const handlers = new Map<string, EventHandler>();
  return {
    getMessageHandler: () => handlers.get("message"),
    on: mock((event: string, handler: EventHandler) => {
      handlers.set(event, handler);
    }),
    publish: mock(async (_channel: string, _message: string) => 0),
    subscribe: mock(async (_channel: string) => undefined),
    quit: mock(async () => "OK" as const),
  };
}

describe("RedisEventBus", () => {
  const originalConsoleError = console.error;

  afterEach(() => {
    console.error = originalConsoleError;
  });

  /** Create a bus with fresh mock clients for each test. */
  function createBus() {
    const pubClient = createMockClient();
    const subClient = createMockClient();
    const bus = new RedisEventBus({ pubClient, subClient } as never);
    return { pubClient, subClient, bus };
  }

  // ─── disconnect() ────────────────────────────────────────────────────

  describe("disconnect()", () => {
    it("should call quit() on both pubClient and subClient", async () => {
      const { pubClient, subClient, bus } = createBus();

      await bus.disconnect();

      expect(pubClient.quit).toHaveBeenCalledTimes(1);
      expect(subClient.quit).toHaveBeenCalledTimes(1);
    });

    it("should be idempotent when called multiple times", async () => {
      const { pubClient, subClient, bus } = createBus();

      await bus.disconnect();
      await expect(bus.disconnect()).resolves.toBeUndefined();
      await expect(bus.disconnect()).resolves.toBeUndefined();

      // quit() should only be called for the first disconnect (2 clients)
      expect(pubClient.quit).toHaveBeenCalledTimes(1);
      expect(subClient.quit).toHaveBeenCalledTimes(1);
    });

    it("should not reject when quit() throws — logs error instead", async () => {
      const errorLogSpy = mock(() => {});
      console.error = errorLogSpy;

      const pubClient = createMockClient();
      const subClient = createMockClient();
      pubClient.quit = mock(async () => {
        throw new Error("Connection closed");
      });
      subClient.quit = mock(async () => {
        throw new Error("Connection closed");
      });
      const bus = new RedisEventBus({ pubClient, subClient } as never);

      await expect(bus.disconnect()).resolves.toBeUndefined();

      expect(pubClient.quit).toHaveBeenCalledTimes(1);
      expect(subClient.quit).toHaveBeenCalledTimes(1);
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
      const { subClient, bus } = createBus();
      const handler = mock(async () => {});

      // The first subscribe() for an eventType triggers Redis subscribe
      bus.subscribe("UserCreated", handler);

      expect(subClient.subscribe).toHaveBeenCalledTimes(1);
      expect(subClient.subscribe).toHaveBeenCalledWith("events:UserCreated");

      // Second subscribe for the same event type should NOT re-subscribe
      bus.subscribe(
        "UserCreated",
        mock(async () => {}),
      );
      expect(subClient.subscribe).toHaveBeenCalledTimes(1);
    });

    it("should subscribe to different channels for different event types", () => {
      const { subClient, bus } = createBus();

      bus.subscribe(
        "UserCreated",
        mock(async () => {}),
      );
      bus.subscribe(
        "UserDeleted",
        mock(async () => {}),
      );

      expect(subClient.subscribe).toHaveBeenCalledTimes(2);
      expect(subClient.subscribe).toHaveBeenCalledWith("events:UserCreated");
      expect(subClient.subscribe).toHaveBeenCalledWith("events:UserDeleted");
    });

    it("should call pubClient.publish with serialized event", async () => {
      const { pubClient, bus } = createBus();
      const event = {
        aggregateId: "user-123",
        eventType: "UserCreated",
        occurredAt: new Date("2024-06-01T12:00:00Z"),
        version: 1,
      };

      const result = await bus.publish(event);

      expect(result.isOk()).toBe(true);
      expect(pubClient.publish).toHaveBeenCalledTimes(1);
      expect(pubClient.publish).toHaveBeenCalledWith(
        "events:UserCreated",
        JSON.stringify(event),
      );
    });

    it("should deliver event to registered handler when message arrives", async () => {
      const pubClient = createMockClient();
      const subClient = createMockClient();
      const bus = new RedisEventBus({ pubClient, subClient } as never);

      // The message handler was captured during construction
      const messageHandler = subClient.getMessageHandler();
      expect(messageHandler).toBeDefined();

      const handler = mock(async (_event: unknown) => {});
      bus.subscribe("UserCreated", handler);

      const eventPayload = {
        aggregateId: "user-456",
        eventType: "UserCreated",
        occurredAt: "2024-06-01T12:00:00.000Z",
        version: 1,
      };
      await messageHandler?.(
        "events:UserCreated",
        JSON.stringify(eventPayload),
      );

      expect(handler).toHaveBeenCalledTimes(1);
      const calledEvent = handler.mock.calls[0]?.[0] as
        | Record<string, unknown>
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
      const pubClient = createMockClient();
      const subClient = createMockClient();
      const bus = new RedisEventBus({ pubClient, subClient } as never);
      const handler1 = mock(async () => {});
      const handler2 = mock(async () => {});

      bus.subscribe("UserCreated", handler1);
      bus.subscribe("UserCreated", handler2);

      await subClient.getMessageHandler()?.(
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
      const pubClient = createMockClient();
      const subClient = createMockClient();
      const bus = new RedisEventBus({ pubClient, subClient } as never);
      const handler = mock(async () => {});

      bus.subscribe("UserCreated", handler);

      // Trigger message for a different event type
      await subClient.getMessageHandler()?.(
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
      const pubClient = createMockClient();
      const subClient = createMockClient();
      const bus = new RedisEventBus({ pubClient, subClient } as never);
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
      expect(pubClient.publish).toHaveBeenCalledTimes(2);
      expect(pubClient.publish).toHaveBeenCalledWith(
        "events:UserCreated",
        JSON.stringify(createdEvent),
      );
      expect(pubClient.publish).toHaveBeenCalledWith(
        "events:UserDeleted",
        JSON.stringify(deletedEvent),
      );

      // Deliver each event via the message handler
      const messageHandler = subClient.getMessageHandler();
      expect(messageHandler).toBeDefined();
      await messageHandler?.(
        "events:UserCreated",
        JSON.stringify({
          aggregateId: createdEvent.aggregateId,
          eventType: createdEvent.eventType,
          occurredAt: createdEvent.occurredAt.toISOString(),
          version: createdEvent.version,
        }),
      );
      await messageHandler?.(
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
