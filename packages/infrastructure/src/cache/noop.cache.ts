import type { ICache } from "@repo/application";

/**
 * NoOpCache — ICache implementation that does nothing.
 *
 * Used in test mode (NODE_ENV === "test") and as a safe fallback
 * when Redis is unavailable. All operations resolve immediately
 * without side effects.
 */
export class NoOpCache implements ICache {
  async get<T>(): Promise<T | undefined> {
    return undefined;
  }

  async set(): Promise<void> {
    // no-op
  }

  async del(): Promise<void> {
    // no-op
  }
}
