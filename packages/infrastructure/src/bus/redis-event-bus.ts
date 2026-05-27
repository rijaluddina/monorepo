import type { IEventBus, IExternalEventBus } from "@repo/application";
import type { DomainEvent } from "@repo/domain";
import {
  type AppError,
  InternalError,
  type Result,
  err,
  ok,
} from "@repo/shared";
import { Redis } from "ioredis";

/**
 * RedisEventBus — A distributed event bus implementation using Redis Pub/Sub.
 */
export class RedisEventBus implements IEventBus, IExternalEventBus {
  private readonly pubClient: Redis;
  private readonly subClient: Redis;
  private readonly handlers = new Map<
    string,
    ((event: DomainEvent) => Promise<void>)[]
  >();

  constructor(redisUrl: string) {
    this.pubClient = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
    });
    this.subClient = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
    });

    this.pubClient.on("error", (error) => {
      console.error("[RedisEventBus] Pub Client Error:", error);
    });

    this.subClient.on("error", (error) => {
      console.error("[RedisEventBus] Sub Client Error:", error);
    });

    this.initRedisSubscription();
  }

  async publish(event: DomainEvent): Promise<Result<void, AppError>> {
    try {
      const channel = `events:${event.eventType}`;
      const message = JSON.stringify(event);
      await this.pubClient.publish(channel, message);
      return ok(undefined);
    } catch (error) {
      return err(
        new InternalError(`Failed to publish event to Redis: ${error}`),
      );
    }
  }

  async publishAll(
    events: ReadonlyArray<DomainEvent>,
  ): Promise<Result<void, AppError>> {
    const results = await Promise.all(events.map((e) => this.publish(e)));
    const firstError = results.find((r) => !r.ok);
    if (firstError && !firstError.ok) {
      return err(firstError.error);
    }
    return ok(undefined);
  }

  subscribe(
    eventType: string,
    handler: (event: DomainEvent) => Promise<void>,
  ): void {
    const existing = this.handlers.get(eventType) ?? [];
    const isNewChannel = existing.length === 0;

    this.handlers.set(eventType, [...existing, handler]);

    if (isNewChannel) {
      const channel = `events:${eventType}`;
      console.log(`[RedisEventBus] 📡 Subscribing to channel: ${channel}`);
      this.subClient.subscribe(channel).catch((err) => {
        console.error(
          `[RedisEventBus] ❌ Failed to subscribe to channel ${channel}:`,
          err,
        );
      });
    }
  }

  private initRedisSubscription(): void {
    this.subClient.on("message", async (channel, message) => {
      const eventType = channel.replace("events:", "");
      const handlers = this.handlers.get(eventType) ?? [];

      try {
        const rawEvent = JSON.parse(message);
        const event: DomainEvent = {
          ...rawEvent,
          occurredAt: new Date(rawEvent.occurredAt),
        };

        await Promise.allSettled(handlers.map((h) => h(event)));
      } catch (error) {
        console.error(
          `[RedisEventBus] Error processing message from channel ${channel}:`,
          error,
        );
      }
    });
  }

  async disconnect(): Promise<void> {
    const results = await Promise.allSettled([
      this.pubClient.quit(),
      this.subClient.quit(),
    ]);

    for (const result of results) {
      if (result.status === "rejected") {
        console.error(
          "[RedisEventBus] Error during disconnect:",
          result.reason,
        );
      }
    }
  }
}
