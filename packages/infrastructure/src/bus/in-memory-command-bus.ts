import type { ICommandBus } from "@repo/application";
import type { Command } from "@repo/application";
import type { Result } from "@repo/shared";
import { AppError, err } from "@repo/shared";

type AnyHandler = { handle(cmd: Command): Promise<Result<unknown>> };

/**
 * InMemoryCommandBus — routes commands to their registered handlers.
 * One handler per command type enforced at registration.
 */
export class InMemoryCommandBus implements ICommandBus {
  private readonly handlers = new Map<string, AnyHandler>();

  register<TCommand extends Command, TResult>(
    commandName: string,
    handler: { handle(cmd: TCommand): Promise<Result<TResult>> },
  ): void {
    if (this.handlers.has(commandName)) {
      throw new Error(`CommandBus: duplicate handler for "${commandName}"`);
    }
    this.handlers.set(commandName, handler as unknown as AnyHandler);
  }

  async dispatch<TCommand extends Command, TResult>(
    command: TCommand,
  ): Promise<TResult> {
    const name = command.constructor.name;
    const handler = this.handlers.get(name);
    if (!handler) {
      throw new AppError(
        `No handler registered for command "${name}"`,
        "NO_HANDLER",
        500,
      );
    }

    const result = await handler.handle(command);
    if (result.isErr()) {
      throw result.error;
    }

    return result.value as TResult;
  }
}
