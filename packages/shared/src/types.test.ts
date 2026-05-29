import { describe, expect, it } from "bun:test";
import { isDisposable } from "./types.ts";

describe("isDisposable", () => {
  // ─── Null / Undefined / Primitives ─────────────────────────────────

  it("should return false for null", () => {
    expect(isDisposable(null)).toBe(false);
  });

  it("should return false for undefined", () => {
    expect(isDisposable(undefined)).toBe(false);
  });

  it("should return false for a string", () => {
    expect(isDisposable("hello")).toBe(false);
  });

  it("should return false for a number", () => {
    expect(isDisposable(42)).toBe(false);
  });

  it("should return false for a boolean", () => {
    expect(isDisposable(true)).toBe(false);
  });

  // ─── Objects without disconnect ──────────────────────────────────

  it("should return false for a plain object", () => {
    expect(isDisposable({})).toBe(false);
  });

  it("should return false for an object with unrelated properties", () => {
    expect(isDisposable({ foo: "bar", baz: 123 })).toBe(false);
  });

  it("should return false for an array", () => {
    expect(isDisposable([1, 2, 3])).toBe(false);
  });

  it("should return false for a Date instance", () => {
    expect(isDisposable(new Date())).toBe(false);
  });

  it("should return false for an Error instance", () => {
    expect(isDisposable(new Error("test"))).toBe(false);
  });

  // ─── Objects with disconnect that is NOT a function ─────────────

  it("should return false when disconnect is a string", () => {
    expect(isDisposable({ disconnect: "not-a-function" })).toBe(false);
  });

  it("should return false when disconnect is a number", () => {
    expect(isDisposable({ disconnect: 42 })).toBe(false);
  });

  it("should return false when disconnect is null", () => {
    expect(isDisposable({ disconnect: null })).toBe(false);
  });

  // ─── Objects with disconnect as a function ──────────────────────

  it("should return true when disconnect is a synchronous function", () => {
    const obj = { disconnect: () => {} };
    expect(isDisposable(obj)).toBe(true);
  });

  it("should return true when disconnect is an async function", () => {
    const obj = { disconnect: async () => {} };
    expect(isDisposable(obj)).toBe(true);
  });

  it("should return true for a class instance implementing IDisposable", () => {
    class Resource {
      async disconnect(): Promise<void> {
        // cleanup
      }
    }
    expect(isDisposable(new Resource())).toBe(true);
  });

  // ─── Type narrowing (compile-time check) ──────────────────────

  it("should narrow type to IDisposable after check", () => {
    const obj: unknown = { disconnect: async () => {} };

    if (isDisposable(obj)) {
      // After the guard, TypeScript knows obj has disconnect()
      expect(typeof obj.disconnect).toBe("function");
      // Calling disconnect should return a Promise
      const result = obj.disconnect();
      expect(result).toBeInstanceOf(Promise);
    } else {
      // Should never reach here with this test value
      expect(true).toBe(false);
    }
  });

  it("should not narrow when isDisposable returns false", () => {
    const obj: unknown = { name: "not-disposable" };

    if (isDisposable(obj)) {
      // Should never reach here
      expect(true).toBe(false);
    } else {
      // obj remains unknown here — type guard didn't narrow
      expect(true).toBe(true);
    }
  });

  // ─── Edge cases ────────────────────────────────────────────────

  it("should return false for a function (typeof fn === 'function')", () => {
    expect(isDisposable(() => {})).toBe(false);
  });

  it("should return false for a symbol", () => {
    expect(isDisposable(Symbol("test"))).toBe(false);
  });

  it("should return false for a bigint", () => {
    expect(isDisposable(BigInt(42))).toBe(false);
  });

  it("should return true even if disconnect ignores its arguments", () => {
    const obj = { disconnect(_unused?: unknown) {} };
    expect(isDisposable(obj)).toBe(true);
  });

  it("should return true for an object with disconnect on prototype", () => {
    const proto = { disconnect() {} };
    const obj = Object.create(proto);
    // obj.disconnect is on the prototype, but `in` operator and property
    // access both traverse the prototype chain.
    expect(isDisposable(obj)).toBe(true);
  });

  it("should not throw for an object with a disconnect getter that throws", () => {
    const obj = {
      get disconnect() {
        throw new Error("boom");
      },
    };
    // getter throws, but isDisposable catches it and returns false
    expect(() => isDisposable(obj)).not.toThrow();
    expect(isDisposable(obj)).toBe(false);
  });
});
