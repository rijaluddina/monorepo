import type { ICache } from "@repo/application";
import { ConsoleLogger } from "@repo/shared";
import type { Logger } from "@repo/shared";
import { getRedisClients } from "../redis/redis.client.ts";

const DEFAULT_TTL_SECONDS = 60;

/**
 * RedisCache — ICache implementation backed by Redis.
 *
 * Uses the shared pubClient from getRedisClients() for get/set/del
 * operations. Errors are logged but never propagated — cache is
 * best-effort and should never block the request flow.
 */
export class RedisCache implements ICache {
  private readonly logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger ?? new ConsoleLogger();
  }

  async get<T>(key: string): Promise<T | undefined> {
    try {
      const value = await getRedisClients().pubClient.get(key);
      if (value === null || value === undefined) return undefined;
      return JSON.parse(value) as T;
    } catch (error) {
      this.logger.error("[RedisCache] GET error:", error);
      return undefined;
    }
  }

  async set(
    key: string,
    value: unknown,
    ttlSeconds = DEFAULT_TTL_SECONDS,
  ): Promise<void> {
    try {
      await getRedisClients().pubClient.setex(
        key,
        ttlSeconds,
        JSON.stringify(value),
      );
    } catch (error) {
      this.logger.error("[RedisCache] SET error:", error);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await getRedisClients().pubClient.del(key);
    } catch (error) {
      this.logger.error("[RedisCache] DEL error:", error);
    }
  }
}
