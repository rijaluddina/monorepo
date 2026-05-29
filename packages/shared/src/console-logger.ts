import type { Logger } from "./types.ts";

/**
 * ConsoleLogger — Explicit Logger implementation that wraps console.*
 * with an ISO timestamp prefix.
 *
 * Unlike using `console` directly as a Logger, this class:
 *  - Provides a concrete type for DI so consumers aren't coupled to
 *    the ambient `console` global.
 *  - Adds an ISO timestamp prefix to every log line for observability.
 *  - Makes it trivial to mock/spy in tests without patching console.
 *
 * @example
 *   const logger = new ConsoleLogger();
 *   logger.info("Server started");
 *   // → "[2026-05-28T10:30:00.000Z] Server started"
 *
 *   logger.error("Failed:", new Error("boom"));
 *   // → "[2026-05-28T10:30:00.000Z] Failed: Error: boom"
 */
export class ConsoleLogger implements Logger {
  private prefix(): string {
    return `[${new Date().toISOString()}]`;
  }

  error(...args: unknown[]): void {
    console.error(this.prefix(), ...args);
  }

  warn(...args: unknown[]): void {
    console.warn(this.prefix(), ...args);
  }

  info(...args: unknown[]): void {
    console.info(this.prefix(), ...args);
  }

  debug(...args: unknown[]): void {
    console.debug(this.prefix(), ...args);
  }
}
