# @repo/shared/testing — Testing Utilities

Framework-agnostic testing helpers exported from `@repo/shared/testing`.

## Usage

```ts
import { MockDisposable, MockLogger } from "@repo/shared/testing";
import { isDisposable } from "@repo/shared";
```

---

## MockDisposable

A lightweight implementation of `IDisposable` that tracks how many times `disconnect()` was called. Useful for verifying cleanup lifecycle in unit tests — no need to mock `bun:test`, `vitest`, or `jest`.

```ts
const resource = new MockDisposable();

await resource.disconnect();
expect(resource.callCount).toBe(1);

// Reset between test cases
resource.reset();
expect(resource.callCount).toBe(0);
```

### With injectable container

```ts
const container = createAppContainer();
container.registerDisposable(new MockDisposable());

await container.disconnect();

// Container called each disposable once
expect(server.callCount).toBe(1);
```

---

## MockLogger

Captures all logging calls (`error`, `warn`, `info`, `debug`) into a `calls` array. Framework-agnostic — no `bun:test` dependency.

```ts
const logger = new MockLogger();

logger.error("err:", new Error("boom"));
logger.info("started");
expect(logger.callCount).toBe(2);
expect(logger.calls[0]).toEqual(["err:", new Error("boom")]);
expect(logger.calls[1]).toEqual(["started"]);

// Reset between tests
logger.reset();
```

### With container that accepts Logger

```ts
const logger = new MockLogger();
const container = createAppContainer(undefined, logger);

// Errors during disconnect are logged via logger, not console.error
const errors = await container.disconnect();
```

---

## isDisposable

Type guard that safely checks whether an unknown value implements `IDisposable`. Handles `null`, primitives, objects without `disconnect`, and even getters that throw.

```ts
if (isDisposable(someObj)) {
  // TypeScript narrows to IDisposable
  disposables.push(someObj);
}
```

### Safe against throwing getters

```ts
const malicious = {
  get disconnect() {
    throw new Error("nope");
  },
};

expect(isDisposable(malicious)).toBe(false); // doesn't throw
```
