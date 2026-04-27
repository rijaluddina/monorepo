import type { Result } from "@repo/shared";
import type { Command } from "./command.js";

/** Each command has exactly one handler */
export interface CommandHandler<TCommand extends Command, TResult> {
  handle(command: TCommand): Promise<Result<TResult>>;
}
