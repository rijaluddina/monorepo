import { BaseDomainEvent } from "../../shared/domain-event.js";

export const USER_EMAIL_CHANGED = "UserEmailChanged" as const;

/**
 * UserEmailChanged — Raised when a user's email is updated.
 */
export class UserEmailChangedEvent extends BaseDomainEvent {
  public readonly oldEmail: string;
  public readonly newEmail: string;

  constructor(aggregateId: string, oldEmail: string, newEmail: string, version: number) {
    super(aggregateId, USER_EMAIL_CHANGED, version);
    this.oldEmail = oldEmail;
    this.newEmail = newEmail;
  }
}
