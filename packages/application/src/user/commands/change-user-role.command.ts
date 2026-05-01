import type { UserRole } from "@repo/domain";
import type { Command } from "../../shared/command.ts";

export class ChangeUserRoleCommand implements Command {
  public readonly _type = "Command" as const;

  constructor(
    public readonly userId: string,
    public readonly role: UserRole,
  ) {}
}
