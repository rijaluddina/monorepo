import { BaseDomainEvent } from "../../shared/domain-event.ts";
import type { UserRole } from "../entities/user.entity.ts";
import type { Email } from "../value-objects/email.vo.ts";
import type { UserName } from "../value-objects/user-name.vo.ts";

export const USER_CREATED = "UserCreated" as const;

/**
 * UserCreated — Raised when a new User aggregate is first created.
 */
export class UserCreatedEvent extends BaseDomainEvent {
  public readonly firstName: string;
  public readonly lastName: string;
  public readonly email: string;
  public readonly role: UserRole;

  constructor(
    aggregateId: string,
    name: UserName,
    email: Email,
    role: UserRole,
    version: number,
  ) {
    super(aggregateId, USER_CREATED, version);
    this.firstName = name.firstName;
    this.lastName = name.lastName;
    this.email = email.value;
    this.role = role;
  }
}
