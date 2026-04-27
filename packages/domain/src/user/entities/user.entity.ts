import { AggregateRoot } from "../../shared/aggregate-root.js";
import { UniqueId } from "../../shared/identifier.js";
import { UserCreatedEvent } from "../events/user-created.event.js";
import { UserEmailChangedEvent } from "../events/user-email-changed.event.js";
import { Email } from "../value-objects/email.vo.js";
import { UserName } from "../value-objects/user-name.vo.js";

export type UserRole = "admin" | "member" | "viewer";

export interface UserProps {
  name: UserName;
  email: Email;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
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
  public static create(createProps: CreateUserProps, id?: UniqueId): User {
    const userId = id ?? new UniqueId();
    const now = new Date();

    const name = UserName.create(createProps.firstName, createProps.lastName);
    const email = Email.create(createProps.email);

    const props: UserProps = {
      name,
      email,
      role: createProps.role ?? "member",
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    const user = new User(props, userId);

    user.addDomainEvent(
      new UserCreatedEvent(userId.value, name, email, user.version + 1),
    );

    return user;
  }

  /**
   * Reconstitute a User from its persisted state (no events raised).
   * Used by the repository when loading from the database.
   */
  public static reconstitute(props: UserProps, id: UniqueId): User {
    return new User(props, id);
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

  // ─── Commands (state mutations) ───────────────────────────────────────

  public changeEmail(newEmail: string): void {
    const email = Email.create(newEmail);
    const oldEmail = this.props.email.value;

    this.props = {
      ...this.props,
      email,
      updatedAt: new Date(),
    };

    this.addDomainEvent(
      new UserEmailChangedEvent(this._id.value, oldEmail, email.value, this.version + 1),
    );
  }

  public deactivate(): void {
    this.props = {
      ...this.props,
      isActive: false,
      updatedAt: new Date(),
    };
  }

  public activate(): void {
    this.props = {
      ...this.props,
      isActive: true,
      updatedAt: new Date(),
    };
  }

  public changeRole(role: UserRole): void {
    this.props = {
      ...this.props,
      role,
      updatedAt: new Date(),
    };
  }
}
