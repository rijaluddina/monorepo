import { BaseDomainEvent } from "../../shared/domain-event.ts";
import type { UserRole } from "../entities/user.entity.ts";

export const USER_ROLE_CHANGED = "UserRoleChanged" as const;

/**
 * UserRoleChanged — Raised when a user's role is updated.
 */
export class UserRoleChangedEvent extends BaseDomainEvent {
  public readonly oldRole: UserRole;
  public readonly newRole: UserRole;

  constructor(
    aggregateId: string,
    oldRole: UserRole,
    newRole: UserRole,
    version: number,
  ) {
    super(aggregateId, USER_ROLE_CHANGED, version);
    this.oldRole = oldRole;
    this.newRole = newRole;
  }
}
