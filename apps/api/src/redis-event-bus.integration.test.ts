/**
 * RedisEventBus Integration Test — Distributed pub/sub with real Redis.
 *
 * Tests the actual Redis Pub/Sub functionality end-to-end:
 *   - Publish → Subscribe event delivery
 *   - publishAll with multiple events
 *   - Event type filtering (handlers only receive matching events)
 *   - Multiple handlers for the same event type
 *   - Clean disconnect
 *
 * Requires a running Redis instance at REDIS_URL (default: localhost:6379).
 * Tests are automatically skipped if Redis is not reachable.
 *
 * To run locally:
 *   1. Start Redis:  docker compose up -d redis
 *   2. Run:          cd apps/api && bun test redis-event-bus.integration.test.ts
 *
 * @see packages/infrastructure/src/bus/redis-event-bus.ts — the implementation
 * @see packages/infrastructure/src/bus/redis-event-bus.test.ts — mocked unit tests
 */

import { afterEach, beforeAll, describe, expect, it } from "bun:test";
import { RedisEventBus } from "@repo/infrastructure";

if (!process.env.REDIS_URL) {
  try {
    const text = await Bun.file("../../.env").text();
    const match = text.match(/^REDIS_URL="?([^"\n]+)"?$/m);
    if (match) process.env.REDIS_URL = match[1];
  } catch {}
}

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

/**
 * Quick connectivity check — pings Redis and returns true if reachable.
 * Uses lazyConnect to avoid hanging if Redis is down.
 */
async function isRedisReachable(url: string): Promise<boolean> {
  try {
    const { Redis } = await import("ioredis");
    const client = new Redis(url, {
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
      lazyConnect: true,
      connectTimeout: 5000,
    });
    await client.connect();
    await client.ping();
    await client.quit();
    return true;
  } catch {
    return false;
  }
}

/**
 * Waits for a condition to be met, polling at a given interval.
 * Times out after maxWaitMs if the condition never becomes true.
 */
async function waitFor(
  condition: () => boolean,
  maxWaitMs = 3000,
  intervalMs = 50,
): Promise<void> {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    if (condition()) return;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  if (!condition()) {
    throw new Error(`Timed out after ${maxWaitMs}ms waiting for condition`);
  }
}

describe("RedisEventBus — Integration", () => {
  let redisReachable = false;
  let bus: RedisEventBus;

  beforeAll(async () => {
    redisReachable = await isRedisReachable(REDIS_URL);
    if (!redisReachable) {
      console.warn(
        "⚠ Redis not reachable — skipping RedisEventBus integration tests",
      );
    }
  });

  afterEach(async () => {
    await bus?.disconnect();
  });

  // ── Publish → Subscribe ───────────────────────────────────────────────

  it("should publish and receive an event via real Redis pub/sub", async () => {
    if (!redisReachable) return;

    bus = new RedisEventBus(REDIS_URL);

    const received: Array<{
      aggregateId: string;
      eventType: string;
      version: number;
    }> = [];

    bus.subscribe("UserCreated", async (event) => {
      received.push({
        aggregateId: event.aggregateId,
        eventType: event.eventType,
        version: event.version,
      });
    });

    // Give Redis time to register the subscription
    await new Promise((r) => setTimeout(r, 200));

    const result = await bus.publish({
      aggregateId: "redis-e2e-1",
      eventType: "UserCreated",
      occurredAt: new Date(),
      version: 1,
    });
    expect(result.isOk()).toBe(true);

    // Wait for the event to be delivered via Redis pub/sub
    await waitFor(() => received.length >= 1);

    expect(received).toHaveLength(1);
    expect(received[0]?.eventType).toBe("UserCreated");
    expect(received[0]?.aggregateId).toBe("redis-e2e-1");
    expect(received[0]?.version).toBe(1);
  });

  // ── publishAll ─────────────────────────────────────────────────────────

  it("should publish multiple events via publishAll and deliver all to subscribers", async () => {
    if (!redisReachable) return;

    bus = new RedisEventBus(REDIS_URL);

    const received: Array<{ aggregateId: string; eventType: string }> = [];

    bus.subscribe("BatchEvent", async (event) => {
      received.push({
        aggregateId: event.aggregateId,
        eventType: event.eventType,
      });
    });

    await new Promise((r) => setTimeout(r, 200));

    const events = [
      {
        aggregateId: "batch-1",
        eventType: "BatchEvent",
        occurredAt: new Date(),
        version: 1,
      },
      {
        aggregateId: "batch-2",
        eventType: "BatchEvent",
        occurredAt: new Date(),
        version: 2,
      },
    ];

    const result = await bus.publishAll(events);
    expect(result.isOk()).toBe(true);

    await waitFor(() => received.length >= 2);

    expect(received).toHaveLength(2);
    expect(received[0]?.aggregateId).toBe("batch-1");
    expect(received[1]?.aggregateId).toBe("batch-2");
  });

  // ── Event type filtering ──────────────────────────────────────────────

  it("should only deliver events to handlers subscribed to the matching event type", async () => {
    if (!redisReachable) return;

    bus = new RedisEventBus(REDIS_URL);

    const receivedTypeA: Array<string> = [];
    const receivedTypeB: Array<string> = [];

    bus.subscribe("TypeA", async (event) => {
      receivedTypeA.push(event.aggregateId);
    });
    bus.subscribe("TypeB", async (event) => {
      receivedTypeB.push(event.aggregateId);
    });

    await new Promise((r) => setTimeout(r, 200));

    await bus.publish({
      aggregateId: "a-only",
      eventType: "TypeA",
      occurredAt: new Date(),
      version: 1,
    });

    // Wait for TypeA event to be delivered
    await waitFor(() => receivedTypeA.length >= 1);

    expect(receivedTypeA).toHaveLength(1);
    expect(receivedTypeA[0]).toBe("a-only");
    // TypeB handler should NOT have been called (we never published TypeB)
    expect(receivedTypeB).toHaveLength(0);
  });

  // ── Multiple handlers for same event type ─────────────────────────────

  it("should call all handlers registered for the same event type", async () => {
    if (!redisReachable) return;

    bus = new RedisEventBus(REDIS_URL);

    const handler1Calls: Array<string> = [];
    const handler2Calls: Array<string> = [];

    bus.subscribe("MultiHandler", async (event) => {
      handler1Calls.push(event.aggregateId);
    });
    bus.subscribe("MultiHandler", async (event) => {
      handler2Calls.push(event.aggregateId);
    });

    await new Promise((r) => setTimeout(r, 200));

    await bus.publish({
      aggregateId: "multi-1",
      eventType: "MultiHandler",
      occurredAt: new Date(),
      version: 1,
    });

    await waitFor(() => handler1Calls.length >= 1 && handler2Calls.length >= 1);

    expect(handler1Calls).toHaveLength(1);
    expect(handler1Calls[0]).toBe("multi-1");
    expect(handler2Calls).toHaveLength(1);
    expect(handler2Calls[0]).toBe("multi-1");
  });

  // ── Disconnect ────────────────────────────────────────────────────────

  it("should disconnect cleanly without throwing", async () => {
    if (!redisReachable) return;

    bus = new RedisEventBus(REDIS_URL);

    // Publish one event to ensure connections are alive
    await bus.publish({
      aggregateId: "disconnect-test",
      eventType: "DisconnectTest",
      occurredAt: new Date(),
      version: 1,
    });

    // Disconnect should resolve without error
    await expect(bus.disconnect()).resolves.toBeUndefined();
  });
});
