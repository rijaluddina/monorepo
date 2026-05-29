import type { IDisposable, Logger } from "./types.ts";

/**
 * Mock implementation of IDisposable for use in unit tests.
 *
 * Tracks calls to disconnect() via callCount and exposes
 * reset() for clean state between test cases.
 *
 * Framework-agnostic — works with bun:test, vitest, jest, etc.
 *
 * @example
 *   import { MockDisposable } from "@repo/shared/testing";
 *
 *   const disposable = new MockDisposable();
 *   await disposable.disconnect();
 *   expect(disposable.callCount).toBe(1);
 *
 *   // Reset between tests
 *   disposable.reset();
 */
export class MockDisposable implements IDisposable {
  /** Number of times disconnect() has been called */
  callCount = 0;

  async disconnect(): Promise<void> {
    this.callCount++;
  }

  /** Reset call count between test cases */
  reset(): void {
    this.callCount = 0;
  }
}

/**
 * Mock implementation of Logger for use in unit tests.
 *
 * Tracks calls to all methods (error, warn, info, debug) via callCount
 * and captured arguments, and exposes reset() for clean state between
 * test cases.
 *
 * Framework-agnostic — works with bun:test, vitest, jest, etc.
 *
 * @example
 *   import { MockLogger } from "@repo/shared/testing";
 *
 *   const logger = new MockLogger();
 *   logger.error("something", "failed");
 *   expect(logger.callCount).toBe(1);
 *   expect(logger.calls[0]).toEqual(["something", "failed"]);
 *
 *   // Reset between tests
 *   logger.reset();
 */
export class MockLogger implements Logger {
  /** Number of times any logging method has been called */
  callCount = 0;

  /** Captured arguments from each logging call (error, warn, info, debug) */
  calls: unknown[][] = [];

  error(...args: unknown[]): void {
    this.callCount++;
    this.calls.push(args);
  }

  warn(...args: unknown[]): void {
    this.callCount++;
    this.calls.push(args);
  }

  info(...args: unknown[]): void {
    this.callCount++;
    this.calls.push(args);
  }

  debug(...args: unknown[]): void {
    this.callCount++;
    this.calls.push(args);
  }

  /** Reset call count and captured calls between test cases */
  reset(): void {
    this.callCount = 0;
    this.calls = [];
  }
}
