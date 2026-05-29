import { describe, expect, it } from "bun:test";
import { MockDisposable, MockLogger } from "./testing.ts";

// ─── MockDisposable ───────────────────────────────────────────────────

describe("MockDisposable", () => {
  it("should start with callCount = 0", () => {
    const disposable = new MockDisposable();
    expect(disposable.callCount).toBe(0);
  });

  it("should increment callCount on each disconnect call", async () => {
    const disposable = new MockDisposable();
    await disposable.disconnect();
    expect(disposable.callCount).toBe(1);

    await disposable.disconnect();
    expect(disposable.callCount).toBe(2);
  });

  it("should support reset() to clear call count", async () => {
    const disposable = new MockDisposable();
    await disposable.disconnect();
    await disposable.disconnect();
    expect(disposable.callCount).toBe(2);

    disposable.reset();
    expect(disposable.callCount).toBe(0);
  });

  it("should resolve disconnect (no rejection)", async () => {
    const disposable = new MockDisposable();
    await expect(disposable.disconnect()).resolves.toBeUndefined();
  });
});

// ─── MockLogger ───────────────────────────────────────────────────────

describe("MockLogger", () => {
  it("should start with callCount = 0 and no calls", () => {
    const logger = new MockLogger();
    expect(logger.callCount).toBe(0);
    expect(logger.calls).toEqual([]);
  });

  it("should track error() calls with arguments", () => {
    const logger = new MockLogger();
    logger.error("err:", new Error("boom"));
    expect(logger.callCount).toBe(1);
    expect(logger.calls[0]).toEqual(["err:", new Error("boom")]);
  });

  it("should track all log levels (error, warn, info, debug)", () => {
    const logger = new MockLogger();
    logger.error("e1");
    logger.warn("w1");
    logger.info("i1");
    logger.debug("d1");

    expect(logger.callCount).toBe(4);
    expect(logger.calls[0]).toEqual(["e1"]);
    expect(logger.calls[1]).toEqual(["w1"]);
    expect(logger.calls[2]).toEqual(["i1"]);
    expect(logger.calls[3]).toEqual(["d1"]);
  });

  it("should support reset() to clear state", () => {
    const logger = new MockLogger();
    logger.info("hello");
    logger.error("world");
    expect(logger.callCount).toBe(2);

    logger.reset();
    expect(logger.callCount).toBe(0);
    expect(logger.calls).toEqual([]);
  });
});
