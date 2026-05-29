import type { Logger } from "@repo/shared";
import pino, { type Logger as PinoInstance } from "pino";

/**
 * PinoLogger — Production-ready Logger implementation using pino.
 *
 * Injects into any consumer that expects the {@link Logger} interface.
 *
 * Uses structured logging: when the second argument is an Error, it is
 * passed as `{err: error}` so pino captures the full stack trace:
 *
 *   logger.error("label:", error)
 *   // → pino.error({err: error}, "label:")
 *
 * @example
 *   import { PinoLogger } from "@repo/infrastructure";
 *
 *   const logger = new PinoLogger();
 *   const container = createAppContainer(db, logger);
 */
export class PinoLogger implements Logger {
  private readonly instance: PinoInstance;

  constructor(instance?: PinoInstance) {
    this.instance =
      instance ??
      pino({
        level: process.env.LOG_LEVEL ?? "info",
      });
  }

  private format(
    level: (...args: unknown[]) => void,
    ...args: unknown[]
  ): void {
    if (args.length === 0) return;
    if (args.length === 1) {
      level(String(args[0]));
      return;
    }
    // Structured logging: if second arg is an Error, pass as {err: error}
    if (args[1] instanceof Error) {
      level({ err: args[1] }, String(args[0]));
      return;
    }
    // Fallback: spread raw args
    level(...args);
  }

  error(...args: unknown[]): void {
    this.format(this.instance.error.bind(this.instance), ...args);
  }

  warn(...args: unknown[]): void {
    this.format(this.instance.warn.bind(this.instance), ...args);
  }

  info(...args: unknown[]): void {
    this.format(this.instance.info.bind(this.instance), ...args);
  }

  debug(...args: unknown[]): void {
    this.format(this.instance.debug.bind(this.instance), ...args);
  }
}
