import { BaseDomainEvent } from "../../shared/domain-event.ts";

export const USER_DEACTIVATED = "UserDeactivated" as const;

/**
 * UserDeactivated — Raised when a user is deactivated.
 */
export class UserDeactivatedEvent extends BaseDomainEvent {
  constructor(aggregateId: string, version: number) {
    super(aggregateId, USER_DEACTIVATED, version);
  }
}
