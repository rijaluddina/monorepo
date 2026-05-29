import { describe, expect, it } from "bun:test";
import pino from "pino";
import { PinoLogger } from "./pino-logger.ts";

/**
 * Create a pino instance that writes to a simple array sink so we can
 * assert on the final structured JSON output without mocking internals.
 */
function sink(): {
  instance: pino.Logger;
  lines: unknown[];
} {
  const lines: unknown[] = [];
  const instance = pino(
    {
      level: "debug",
    },
    {
      write: (line: string) => {
        lines.push(JSON.parse(line));
      },
    },
  );
  return { instance, lines };
}

describe("PinoLogger", () => {
  describe("single-argument calls", () => {
    it("should log a simple info message", () => {
      const { instance, lines } = sink();
      const logger = new PinoLogger(instance);

      logger.info("Hello world");

      expect(lines).toHaveLength(1);
      const entry = lines[0] as Record<string, unknown>;
      expect(entry.msg).toBe("Hello world");
      expect(entry.level).toBe(pino.levels.values.info);
    });

    it("should log a debug message at the correct level", () => {
      const { instance, lines } = sink();
      const logger = new PinoLogger(instance);

      logger.debug("Debug message");

      expect(lines).toHaveLength(1);
      const entry = lines[0] as Record<string, unknown>;
      expect(entry.msg).toBe("Debug message");
      expect(entry.level).toBe(pino.levels.values.debug);
    });

    it("should log a warn message at the correct level", () => {
      const { instance, lines } = sink();
      const logger = new PinoLogger(instance);

      logger.warn("Warning message");

      expect(lines).toHaveLength(1);
      const entry = lines[0] as Record<string, unknown>;
      expect(entry.msg).toBe("Warning message");
      expect(entry.level).toBe(pino.levels.values.warn);
    });

    it("should log an error message at the correct level", () => {
      const { instance, lines } = sink();
      const logger = new PinoLogger(instance);

      logger.error("Error message");

      expect(lines).toHaveLength(1);
      const entry = lines[0] as Record<string, unknown>;
      expect(entry.msg).toBe("Error message");
      expect(entry.level).toBe(pino.levels.values.error);
    });
  });

  describe("structured logging — Error as second argument", () => {
    it("should pass Error as {err: error} for full stack trace", () => {
      const { instance, lines } = sink();
      const logger = new PinoLogger(instance);

      const error = new Error("Database connection failed");
      logger.error("DB error:", error);

      expect(lines).toHaveLength(1);
      const entry = lines[0] as Record<string, unknown>;
      expect(entry.msg).toBe("DB error:");
      // pino serialises Error into `err` with type, message, stack
      expect(entry.err).toBeDefined();
      expect((entry.err as Record<string, unknown>).type).toBe("Error");
      expect((entry.err as Record<string, unknown>).message).toBe(
        "Database connection failed",
      );
      expect((entry.err as Record<string, unknown>).stack).toBeDefined();
    });

    it("should stringify single Error argument as message", () => {
      const { instance, lines } = sink();
      const logger = new PinoLogger(instance);

      const error = new Error("Just an error");
      logger.error(error);

      expect(lines).toHaveLength(1);
      const entry = lines[0] as Record<string, unknown>;
      // Single arg goes through the `level(String(args[0]))` path,
      // so the Error is stringified into the msg, not passed as {err}
      expect(entry.msg).toContain("Error: Just an error");
    });
  });

  describe("edge cases", () => {
    it("should be no-op when called with no arguments", () => {
      const { instance, lines } = sink();
      const logger = new PinoLogger(instance);

      logger.info();

      // format() returns early when args.length === 0
      expect(lines).toHaveLength(0);
    });

    it("should handle multiple string arguments", () => {
      const { instance, lines } = sink();
      const logger = new PinoLogger(instance);

      logger.info("a", "b", "c");

      expect(lines).toHaveLength(1);
      const entry = lines[0] as Record<string, unknown>;
      // pino joins extra args — msg is "a" + additional args in array
      expect(entry.msg).toBe("a");
    });

    it("should handle non-Error second argument normally", () => {
      const { instance, lines } = sink();
      const logger = new PinoLogger(instance);

      logger.info("Count:", 42);

      expect(lines).toHaveLength(1);
      const entry = lines[0] as Record<string, unknown>;
      expect(entry.msg).toBe("Count:");
    });

    it("should handle structured Error via warn() level too", () => {
      const { instance, lines } = sink();
      const logger = new PinoLogger(instance);

      const error = new Error("Retry failed");
      logger.warn("warn:", error);

      expect(lines).toHaveLength(1);
      const entry = lines[0] as Record<string, unknown>;
      expect(entry.msg).toBe("warn:");
      expect((entry.err as Record<string, unknown>).message).toBe(
        "Retry failed",
      );
    });
  });
});
