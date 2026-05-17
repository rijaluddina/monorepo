import type { DomainEvent } from "../../shared/domain-event.ts";

export const USER_RESTORED = "USER_RESTORED";

export class UserRestoredEvent implements DomainEvent {
  public readonly eventType = USER_RESTORED;
  public readonly occurredAt: Date;

  constructor(
    public readonly aggregateId: string,
    public readonly version: number,
  ) {
    this.occurredAt = new Date();
  }
}
