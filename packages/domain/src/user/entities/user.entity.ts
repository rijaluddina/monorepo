import {
  type Result,
  ValidationError,
  combine,
  err,
  isErr,
  ok,
} from "@repo/shared";
import { AggregateRoot } from "../../shared/aggregate-root.ts";
import type { DomainEvent } from "../../shared/domain-event.ts";
import { UniqueId } from "../../shared/identifier.ts";
import {
  USER_ACTIVATED,
  UserActivatedEvent,
} from "../events/user-activated.event.ts";
import {
  USER_CREATED,
  UserCreatedEvent,
} from "../events/user-created.event.ts";
import {
  USER_DEACTIVATED,
  UserDeactivatedEvent,
} from "../events/user-deactivated.event.ts";
import {
  USER_DELETED,
  UserDeletedEvent,
} from "../events/user-deleted.event.ts";
import {
  USER_EMAIL_CHANGED,
  UserEmailChangedEvent,
} from "../events/user-email-changed.event.ts";
import {
  USER_ROLE_CHANGED,
  UserRoleChangedEvent,
} from "../events/user-role-changed.event.ts";
import { Email } from "../value-objects/email.vo.ts";
import { UserName } from "../value-objects/user-name.vo.ts";

export type UserRole = "admin" | "member" | "viewer";

export interface UserProps {
  name: UserName;
  email: Email;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface CreateUserProps {
  firstName: string;
  lastName: string;
  email: string;
  role?: UserRole;
}

/**
 * User — Aggregate Root for the User bounded context.
 *
 * All state mutations go through methods on this class.
 * Each mutation raises a DomainEvent (Event Sourcing).
 */
export class User extends AggregateRoot<UserProps> {
  private constructor(props: UserProps, id: UniqueId) {
    super(props, id);
  }

  // ─── Factory ──────────────────────────────────────────────────────────

  /**
   * Named constructor — creates a new User and raises UserCreatedEvent.
   */
  public static create(
    createProps: CreateUserProps,
    id?: UniqueId,
  ): Result<User, ValidationError> {
    const userId = id ?? new UniqueId();

    const nameResult = UserName.create(
      createProps.firstName,
      createProps.lastName,
    );
    const emailResult = Email.create(createProps.email);

    const result = combine([nameResult, emailResult]);

    if (isErr(result)) {
      return err<User, ValidationError>(result.error);
    }

    const [name, email] = result.value;
    const role = createProps.role ?? "member";

    // Create an empty sentinel to satisfy types before apply overwrites it
    const emptyProps: UserProps = {
      name: name,
      email: email,
      role: role,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const user = new User(emptyProps, userId);

    const event = new UserCreatedEvent(
      userId.value,
      name,
      email,
      role,
      user.version + 1,
    );

    user.apply(event);
    user.addDomainEvent(event);

    return ok(user);
  }

  /**
   * Reconstitute a User from its persisted state (no events raised).
   * Used by the repository when loading from the database.
   */
  public static reconstitute(
    props: UserProps,
    id: UniqueId,
    version: number,
  ): User {
    const user = new User(props, id);
    user.setVersion(version);
    return user;
  }

  /**
   * Reconstitute a User from a stream of domain events.
   */
  public static fromEvents(
    events: DomainEvent[],
    id: UniqueId,
  ): Result<User, ValidationError> {
    if (events.length === 0) {
      return err(new ValidationError("No events provided for reconstitution"));
    }

    const firstEvent = events[0];
    if (!firstEvent || firstEvent.eventType !== USER_CREATED) {
      return err(new ValidationError("First event must be USER_CREATED"));
    }

    // Create an empty sentinel to satisfy types before replay overwrites it
    const emptyProps: UserProps = {
      name: UserName.create("Empty", "User").unwrap(),
      email: Email.create("empty@example.com").unwrap(),
      role: "viewer",
      isActive: false,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    };

    const user = new User(emptyProps, id);
    const result = user.replay(events);
    if (isErr(result)) return err(result.error);
    return ok(user);
  }

  // ─── Getters ──────────────────────────────────────────────────────────

  get name(): UserName {
    return this.props.name;
  }

  get email(): Email {
    return this.props.email;
  }

  get role(): UserRole {
    return this.props.role;
  }

  get isActive(): boolean {
    return this.props.isActive;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get deletedAt(): Date | undefined {
    return this.props.deletedAt;
  }

  get isDeleted(): boolean {
    return !!this.props.deletedAt;
  }

  // ─── Mutations ────────────────────────────────────────────────────────

  public changeEmail(newEmail: string): Result<void, ValidationError> {
    const emailResult = Email.create(newEmail);
    if (isErr(emailResult)) return err(emailResult.error);

    const email = emailResult.value;
    if (this.props.email.equals(email)) return ok();

    const event = new UserEmailChangedEvent(
      this.id.value,
      this.props.email.value,
      email.value,
      this.version + 1,
    );

    this.apply(event);
    this.addDomainEvent(event);

    return ok();
  }

  public deactivate(): void {
    if (!this.props.isActive) return;

    const event = new UserDeactivatedEvent(this.id.value, this.version + 1);
    this.apply(event);
    this.addDomainEvent(event);
  }

  public activate(): void {
    if (this.props.isActive) return;

    const event = new UserActivatedEvent(this.id.value, this.version + 1);
    this.apply(event);
    this.addDomainEvent(event);
  }

  public changeRole(newRole: UserRole): void {
    if (this.props.role === newRole) return;

    const event = new UserRoleChangedEvent(
      this.id.value,
      this.props.role,
      newRole,
      this.version + 1,
    );

    this.apply(event);
    this.addDomainEvent(event);
  }

  public delete(): void {
    const event = new UserDeletedEvent(this.id.value, this.version + 1);
    this.apply(event);
    this.addDomainEvent(event);
  }

  // ─── Event Sourcing ───────────────────────────────────────────────────

  protected apply(event: DomainEvent): Result<void, ValidationError> {
    // biome-ignore lint/suspicious/noExplicitAny: needed for event sourcing reconstitution from serialized events
    const payload = event as any;

    switch (event.eventType) {
      case USER_CREATED: {
        const nameResult = UserName.create(payload.firstName, payload.lastName);
        const emailResult = Email.create(payload.email);
        const result = combine([nameResult, emailResult]);

        if (isErr(result)) return err(result.error);
        const [name, email] = result.value;

        this.props = {
          name,
          email,
          role: payload.role,
          isActive: true,
          createdAt: event.occurredAt,
          updatedAt: event.occurredAt,
        };
        break;
      }
      case USER_EMAIL_CHANGED: {
        const emailResult = Email.create(payload.newEmail);
        if (isErr(emailResult)) return err(emailResult.error);

        this.props = {
          ...this.props,
          email: emailResult.value,
          updatedAt: event.occurredAt,
        };
        break;
      }
      case USER_DEACTIVATED:
        this.props = {
          ...this.props,
          isActive: false,
          updatedAt: event.occurredAt,
        };
        break;
      case USER_ACTIVATED:
        this.props = {
          ...this.props,
          isActive: true,
          updatedAt: event.occurredAt,
        };
        break;
      case USER_ROLE_CHANGED:
        this.props = {
          ...this.props,
          role: payload.newRole,
          updatedAt: event.occurredAt,
        };
        break;
      case USER_DELETED:
        this.props = {
          ...this.props,
          deletedAt: event.occurredAt,
          updatedAt: event.occurredAt,
        };
        break;
      default:
        return err(
          new ValidationError(`Unknown event type: ${event.eventType}`),
        );
    }
    return ok(undefined);
  }
}
