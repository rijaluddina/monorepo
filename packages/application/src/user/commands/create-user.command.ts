import type { UserRole } from "@repo/domain";
import type { Command } from "../../shared/command.js";

export class CreateUserCommand implements Command {
  public readonly _type = "Command" as const;

  constructor(
    public readonly firstName: string,
    public readonly lastName: string,
    public readonly email: string,
    public readonly role: UserRole = "member",
  ) {}
}
