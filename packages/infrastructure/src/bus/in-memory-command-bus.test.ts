import { describe, expect, it, mock } from "bun:test";
import { InMemoryCommandBus } from "./in-memory-command-bus.js";
import type { Command } from "@repo/application";
import { ok, err, AppError } from "@repo/shared";

class TestCommand implements Command {
  readonly _type = "Command";
  constructor(public readonly data: string) {}
}

class UnregisteredCommand implements Command {
  readonly _type = "Command";
}

describe("InMemoryCommandBus", () => {
  it("should dispatch a command to its registered handler", async () => {
    const bus = new InMemoryCommandBus();
    const handler = {
      handle: mock(async (cmd: TestCommand) => ok("success")),
    };
    
    bus.register("TestCommand", handler);
    
    const command = new TestCommand("payload");
    const result = await bus.dispatch(command);
    
    expect(handler.handle).toHaveBeenCalled();
    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toBe("success");
  });

  it("should return an error if no handler is registered", async () => {
    const bus = new InMemoryCommandBus();
    const command = new UnregisteredCommand();
    
    const result = await bus.dispatch(command);
    
    expect(result.isErr()).toBe(true);
    expect(result.error?.code).toBe("NO_HANDLER");
  });

  it("should return the error from the handler if it fails", async () => {
    const bus = new InMemoryCommandBus();
    const handlerError = new AppError("Handler failed", "HANDLER_ERROR");
    const handler = {
      handle: mock(async (cmd: TestCommand) => err(handlerError)),
    };
    
    bus.register("TestCommand", handler);
    
    const command = new TestCommand("payload");
    const result = await bus.dispatch(command);
    
    expect(result.isErr()).toBe(true);
    expect(result.error).toBe(handlerError);
  });

  it("should throw if registering a duplicate handler", () => {
    const bus = new InMemoryCommandBus();
    const handler = { handle: async () => ok() };
    
    bus.register("TestCommand", handler);
    
    expect(() => bus.register("TestCommand", handler)).toThrow(
      'CommandBus: duplicate handler for "TestCommand"',
    );
  });
});
