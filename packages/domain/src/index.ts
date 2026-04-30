// Shared DDD building blocks
export { AggregateRoot } from "./shared/aggregate-root.ts";
export { Entity } from "./shared/entity.ts";
export { ValueObject } from "./shared/value-object.ts";
export { BaseDomainEvent } from "./shared/domain-event.ts";
export type { DomainEvent } from "./shared/domain-event.ts";
export { UniqueId } from "./shared/identifier.ts";

// User bounded context — entities
export { User } from "./user/entities/user.entity.ts";
export type {
  UserProps,
  CreateUserProps,
  UserRole,
} from "./user/entities/user.entity.ts";

// User bounded context — value objects
export { Email } from "./user/value-objects/email.vo.ts";
export { UserName } from "./user/value-objects/user-name.vo.ts";

// User bounded context — domain events
export {
  UserCreatedEvent,
  USER_CREATED,
} from "./user/events/user-created.event.ts";
export {
  UserEmailChangedEvent,
  USER_EMAIL_CHANGED,
} from "./user/events/user-email-changed.event.ts";
