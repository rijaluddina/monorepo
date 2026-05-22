import type { IEventBus } from "@repo/application";
import type { IUserRepository } from "@repo/application";
import type { DomainEvent } from "@repo/domain";
import {
  USER_ACTIVATED,
  USER_CREATED,
  USER_DEACTIVATED,
  USER_DELETED,
  USER_EMAIL_CHANGED,
  USER_ROLE_CHANGED,
} from "@repo/domain";
import { UniqueId, User } from "@repo/domain";

/**
 * @deprecated This class is kept as a reference for pure event sourcing.
 * The current hybrid approach updates the read model synchronously
 * in the same transaction (see DrizzleUserRepository.save()).
 *
 * UserProjection — Subscriber that maintains the User Read Model (the "users" table).
 *
 * In a Pure Event Sourcing model, the Read Model is updated by reacting to events.
 * This can be synchronous (same transaction) or asynchronous (eventual consistency).
 */
export class UserProjection {
  constructor(
    private readonly eventBus: IEventBus,
    private readonly userRepository: IUserRepository,
  ) {}

  /**
   * Register all event handlers for this projection.
   */
  public register(): void {
    const eventTypes = [
      USER_CREATED,
      USER_EMAIL_CHANGED,
      USER_ACTIVATED,
      USER_DEACTIVATED,
      USER_ROLE_CHANGED,
      USER_DELETED,
    ];

    for (const type of eventTypes) {
      this.eventBus.subscribe(type, (event) => this.handle(event));
    }
  }

  private async handle(event: DomainEvent): Promise<void> {
    console.log(
      `[UserProjection] Handling event: ${event.eventType} for aggregate: ${event.aggregateId}`,
    );

    // 1. Reconstitute the aggregate from the current Read Model
    const userResult = await this.userRepository.findById(event.aggregateId);

    if (userResult.isErr()) {
      console.error(
        `[UserProjection] Failed to find user ${event.aggregateId}:`,
        userResult.error,
      );
      return;
    }

    let user = userResult.value;

    // 2. Check for idempotency: if user version >= event version, skip
    if (user && user.version >= event.version) {
      console.log(
        `[UserProjection] Event ${event.eventType} for aggregate ${event.aggregateId} already applied (version ${user.version} >= ${event.version}). Skipping.`,
      );
      return;
    }

    // 3. If it's a creation event and user doesn't exist, we start fresh
    if (!user && event.eventType === USER_CREATED) {
      // We need to create a dummy user first then apply events, or just apply to a "new" user.
      // The User.fromEvents is better but we only have one event here.
      const result = User.fromEvents([event], new UniqueId(event.aggregateId));
      if (result.isErr()) {
        console.error(
          "[UserProjection] Failed to create user from event:",
          result.error,
        );
        return;
      }
      user = result.value;
    } else if (user) {
      // 3. Apply the single event to the current state
      // We use a internal method or just replay.
      // Since 'apply' is protected, we can use 'replay'.
      const result = user.replay([event]);
      if (result.isErr()) {
        console.error(
          `[UserProjection] Failed to apply event ${event.eventType} to user ${user.id.value}:`,
          result.error,
        );
        return;
      }
    } else {
      console.warn(
        `[UserProjection] Received event ${event.eventType} for non-existent user ${event.aggregateId}`,
      );
      return;
    }

    // 4. Save the updated Read Model
    const saveResult = await this.userRepository.save(user);
    if (saveResult.isErr()) {
      console.error(
        `[UserProjection] Failed to save Read Model for user ${user.id.value}:`,
        saveResult.error,
      );
    }
  }
}
