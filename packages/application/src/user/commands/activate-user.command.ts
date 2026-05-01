import type { Command } from "../../shared/command.ts";

export class ActivateUserCommand implements Command {
  public readonly _type = "Command" as const;

  constructor(public readonly userId: string) {}
}
