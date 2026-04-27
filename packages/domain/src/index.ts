// Shared DDD building blocks
export { AggregateRoot } from "./shared/aggregate-root.js";
export { Entity } from "./shared/entity.js";
export { ValueObject } from "./shared/value-object.js";
export { BaseDomainEvent } from "./shared/domain-event.js";
export type { DomainEvent } from "./shared/domain-event.js";
export { UniqueId } from "./shared/identifier.js";

// User bounded context — entities
export { User } from "./user/entities/user.entity.js";
export type { UserProps, CreateUserProps, UserRole } from "./user/entities/user.entity.js";

// User bounded context — value objects
export { Email } from "./user/value-objects/email.vo.js";
export { UserName } from "./user/value-objects/user-name.vo.js";

// User bounded context — domain events
export { UserCreatedEvent, USER_CREATED } from "./user/events/user-created.event.js";
export {
  UserEmailChangedEvent,
  USER_EMAIL_CHANGED,
} from "./user/events/user-email-changed.event.js";
