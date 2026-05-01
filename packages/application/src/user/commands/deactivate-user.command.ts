import type { Command } from "../../shared/command.ts";

export class DeactivateUserCommand implements Command {
  public readonly _type = "Command" as const;

  constructor(public readonly userId: string) {}
}
