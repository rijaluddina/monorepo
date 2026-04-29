import { BaseDomainEvent } from "../../shared/domain-event.js";

export const USER_ACTIVATED = "UserActivated" as const;

/**
 * UserActivated — Raised when a user is activated.
 */
export class UserActivatedEvent extends BaseDomainEvent {
  constructor(aggregateId: string, version: number) {
    super(aggregateId, USER_ACTIVATED, version);
  }
}
