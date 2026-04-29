import { BaseDomainEvent } from "../../shared/domain-event.js";
import type { Email } from "../value-objects/email.vo.js";
import type { UserName } from "../value-objects/user-name.vo.js";

export const USER_CREATED = "UserCreated" as const;

/**
 * UserCreated — Raised when a new User aggregate is first created.
 */
export class UserCreatedEvent extends BaseDomainEvent {
  public readonly name: string;
  public readonly email: string;

  constructor(
    aggregateId: string,
    name: UserName,
    email: Email,
    version: number,
  ) {
    super(aggregateId, USER_CREATED, version);
    this.name = name.fullName;
    this.email = email.value;
  }
}
