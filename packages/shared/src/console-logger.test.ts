import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { ConsoleLogger } from "./console-logger.ts";

// ─── Helpers ──────────────────────────────────────────────────────────

/**
 * Capture writes to a given console method without affecting other methods.
 * Returns the spy for assertions.
 */
function captureConsole(method: "log" | "error" | "warn" | "info" | "debug"): {
  spy: ReturnType<typeof mock>;
} {
  const original = console[method];
  const spy = mock();

  beforeEach(() => {
    spy.mockClear();
    console[method] = spy as typeof console.log;
  });

  afterEach(() => {
    console[method] = original;
  });

  return { spy };
}

// ─── Tests ────────────────────────────────────────────────────────────

describe("ConsoleLogger", () => {
  describe("error()", () => {
    const { spy } = captureConsole("error");

    it("should call console.error with timestamp prefix", () => {
      const logger = new ConsoleLogger();
      logger.error("Server failed");

      expect(spy).toHaveBeenCalledTimes(1);
      const args = spy.mock.calls[0] as unknown[];
      expect(args[0]).toMatch(/^\[\d{4}-\d{2}-\d{2}T/); // ISO timestamp
      expect(args[1]).toBe("Server failed");
    });

    it("should pass multiple arguments after prefix", () => {
      const logger = new ConsoleLogger();
      const err = new Error("boom");
      logger.error("label:", err);

      expect(spy).toHaveBeenCalledTimes(1);
      const args = spy.mock.calls[0] as unknown[];
      expect(args[0]).toMatch(/^\[\d{4}-\d{2}-\d{2}T/);
      expect(args[1]).toBe("label:");
      expect(args[2]).toBe(err);
    });
  });

  describe("warn()", () => {
    const { spy } = captureConsole("warn");

    it("should call console.warn with timestamp prefix", () => {
      const logger = new ConsoleLogger();
      logger.warn("Disk space low");

      expect(spy).toHaveBeenCalledTimes(1);
      const args = spy.mock.calls[0] as unknown[];
      expect(args[0]).toMatch(/^\[\d{4}-\d{2}-\d{2}T/);
      expect(args[1]).toBe("Disk space low");
    });
  });

  describe("info()", () => {
    const { spy } = captureConsole("info");

    it("should call console.info with timestamp prefix", () => {
      const logger = new ConsoleLogger();
      logger.info("Server started");

      expect(spy).toHaveBeenCalledTimes(1);
      const args = spy.mock.calls[0] as unknown[];
      expect(args[0]).toMatch(/^\[\d{4}-\d{2}-\d{2}T/);
      expect(args[1]).toBe("Server started");
    });
  });

  describe("debug()", () => {
    const { spy } = captureConsole("debug");

    it("should call console.debug with timestamp prefix", () => {
      const logger = new ConsoleLogger();
      logger.debug("Connecting to DB...");

      expect(spy).toHaveBeenCalledTimes(1);
      const args = spy.mock.calls[0] as unknown[];
      expect(args[0]).toMatch(/^\[\d{4}-\d{2}-\d{2}T/);
      expect(args[1]).toBe("Connecting to DB...");
    });
  });

  describe("all levels — structural conformance", () => {
    it("should satisfy the Logger interface (error, warn, info, debug)", () => {
      const logger = new ConsoleLogger();

      // These should not throw
      expect(() => logger.error("e")).not.toThrow();
      expect(() => logger.warn("w")).not.toThrow();
      expect(() => logger.info("i")).not.toThrow();
      expect(() => logger.debug("d")).not.toThrow();
    });
  });
});
