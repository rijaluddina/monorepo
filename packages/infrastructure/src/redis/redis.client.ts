import { Redis } from "ioredis";

const DEFAULT_REDIS_URL = "redis://localhost:6379";

let clients: { pubClient: Redis; subClient: Redis } | null = null;

/**
 * getRedisClients — Lazily creates and returns Redis pub/sub clients.
 *
 * Clients are created once and cached for the lifetime of the process.
 * Calling this function in test mode will create real Redis connections;
 * the caller (app-container) is responsible for using InMemoryEventBus
 * when NODE_ENV === "test".
 *
 * Design matches drizzle.client.ts singleton pattern, but uses lazy
 * initialization so that importing this module does not trigger a
 * connection — important for test environments where Redis may not
 * be running.
 */
export function getRedisClients(): {
  pubClient: Redis;
  subClient: Redis;
} {
  if (!clients) {
    const redisUrl = process.env.REDIS_URL || DEFAULT_REDIS_URL;

    clients = {
      pubClient: new Redis(redisUrl, {
        maxRetriesPerRequest: null,
      }),
      subClient: new Redis(redisUrl, {
        maxRetriesPerRequest: null,
      }),
    };
  }

  return clients;
}
