import { describe, expect, it } from "bun:test";
import { PinoLogger } from "@repo/infrastructure";
import pino from "pino";
import { handleServerError } from "./server";

process.env.NODE_ENV = "test";

// ─── Helpers ─────────────────────────────────────────────────────

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
    { level: "debug" },
    {
      write: (line: string) => {
        lines.push(JSON.parse(line));
      },
    },
  );
  return { instance, lines };
}

// ─── Tests ───────────────────────────────────────────────────────

describe("PinoLogger structured error logging", () => {
  describe("{err} serialization", () => {
    it("should log Error as {err: {type, message, stack}}", () => {
      const { instance, lines } = sink();
      const logger = new PinoLogger(instance);
      const set = { status: 200 };

      const error = new Error("User not found");
      (error as unknown as Record<string, unknown>).status = 404;

      handleServerError(logger, error, set);

      expect(set.status).toBe(404);

      const entry = lines[0] as Record<string, unknown> | undefined;
      expect(entry).toBeDefined();
      expect(entry?.msg).toBe("API Error Captured:");
      expect(entry?.err).toBeDefined();
      expect((entry?.err as Record<string, unknown>).type).toBe("Error");
      expect((entry?.err as Record<string, unknown>).message).toBe(
        "User not found",
      );
      expect((entry?.err as Record<string, unknown>).stack).toBeDefined();
    });

    it("should serialize 409 Conflict errors with {err}", () => {
      const { instance, lines } = sink();
      const logger = new PinoLogger(instance);
      const set = { status: 200 };

      const error = new Error("Email already in use");
      (error as unknown as Record<string, unknown>).status = 409;

      handleServerError(logger, error, set);

      expect(set.status).toBe(409);

      const entry = lines[0] as Record<string, unknown> | undefined;
      expect(entry).toBeDefined();
      expect(entry?.err).toBeDefined();
      expect((entry?.err as Record<string, unknown>).message).toContain(
        "already in use",
      );
    });

    it("should serialize 500 errors with {err} and hide internal message", () => {
      const { instance, lines } = sink();
      const logger = new PinoLogger(instance);
      const set = { status: 200 };

      const error = new Error("Something went wrong");

      const response = handleServerError(logger, error, set);

      expect(set.status).toBe(500);
      expect(response.error.message).toBe("Internal server error");

      const entry = lines[0] as Record<string, unknown> | undefined;
      expect(entry).toBeDefined();
      expect(entry?.err).toBeDefined();
      expect((entry?.err as Record<string, unknown>).message).toBe(
        "Something went wrong",
      );
    });

    it("should handle custom error shapes — no {err} wrapping for plain objects", () => {
      const { instance, lines } = sink();
      const logger = new PinoLogger(instance);
      const set = { status: 200 };

      const error = {
        statusCode: 422,
        code: "VALIDATION_ERROR",
        message: "Invalid email format",
      };

      handleServerError(logger, error, set);

      expect(set.status).toBe(422);

      const entry = lines[0] as Record<string, unknown> | undefined;
      expect(entry).toBeDefined();
      expect(entry?.msg).toBe("API Error Captured:");
      // Plain objects don't get {err} wrapping (only Error instances do)
      expect(entry?.err).toBeUndefined();
    });
  });

  describe("log level and timestamp", () => {
    it("should log at error level (50)", () => {
      const { instance, lines } = sink();
      const logger = new PinoLogger(instance);
      const set = { status: 200 };

      handleServerError(logger, new Error("test"), set);

      const entry = lines[0] as Record<string, unknown> | undefined;
      expect(entry).toBeDefined();
      expect(entry?.level).toBe(50);
    });

    it("should include a valid numeric timestamp", () => {
      const { instance, lines } = sink();
      const logger = new PinoLogger(instance);
      const set = { status: 200 };

      handleServerError(logger, new Error("test"), set);

      const entry = lines[0] as Record<string, unknown> | undefined;
      expect(entry).toBeDefined();
      expect(typeof entry?.time).toBe("number");
      expect(entry?.time).toBeGreaterThan(Date.now() - 60_000);
      expect(entry?.time).toBeLessThan(Date.now() + 60_000);
    });
  });
});
