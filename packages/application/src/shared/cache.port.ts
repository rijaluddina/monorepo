import type { AppError, Result } from "@repo/shared";

/**
 * ICache — Port for caching query results.
 *
 * Infrastructure provides implementations (e.g., RedisCache for production,
 * NoOpCache for testing).
 */
export interface ICache {
  /**
   * get — Retrieves a cached value by key.
   * Returns undefined if the key is not found or expired.
   */
  get<T>(key: string): Promise<T | undefined>;

  /**
   * set — Stores a value in the cache with an optional TTL.
   * @param ttlSeconds — Time-to-live in seconds (default: 60).
   */
  set(key: string, value: unknown, ttlSeconds?: number): Promise<void>;

  /**
   * del — Removes a value from the cache by key.
   */
  del(key: string): Promise<void>;
}
