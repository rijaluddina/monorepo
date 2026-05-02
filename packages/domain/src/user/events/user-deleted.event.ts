import { BaseDomainEvent } from "../../shared/domain-event.ts";

export const USER_DELETED = "UserDeleted" as const;

/**
 * UserDeleted — Raised before a user is hard deleted.
 */
export class UserDeletedEvent extends BaseDomainEvent {
  constructor(aggregateId: string, version: number) {
    super(aggregateId, USER_DELETED, version);
  }
}
