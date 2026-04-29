import type { Result, AppError } from "@repo/shared";
import type { Command } from "./command.js";

/**
 * ICommandBus — Port (Dependency Inversion).
 * Infrastructure provides the implementation.
 */
export interface ICommandBus {
  dispatch<TCommand extends Command, TResult>(
    command: TCommand,
  ): Promise<Result<TResult, AppError>>;
  register<TCommand extends Command, TResult>(
    commandName: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handler: {
      handle(cmd: TCommand): Promise<Result<TResult>>;
    },
  ): void;
}
