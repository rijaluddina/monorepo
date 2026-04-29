import {
  type Result,
  type ValidationError,
  combine,
  err,
  isErr,
  ok,
} from "@repo/shared";
import { AggregateRoot } from "../../shared/aggregate-root.js";
import { UniqueId } from "../../shared/identifier.js";
import { UserActivatedEvent } from "../events/user-activated.event.js";
import { UserCreatedEvent } from "../events/user-created.event.js";
import { UserDeactivatedEvent } from "../events/user-deactivated.event.js";
import { UserEmailChangedEvent } from "../events/user-email-changed.event.js";
import { UserRoleChangedEvent } from "../events/user-role-changed.event.js";
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
  public static create(
    createProps: CreateUserProps,
    id?: UniqueId,
  ): Result<User, ValidationError> {
    const userId = id ?? new UniqueId();
    const now = new Date();

    const nameResult = UserName.create(
      createProps.firstName,
      createProps.lastName,
    );
    const emailResult = Email.create(createProps.email);

    const result = combine<[UserName, Email], ValidationError>([
      nameResult,
      emailResult,
    ]);

    if (isErr(result)) {
      return err<User, ValidationError>(result.error);
    }

    const [name, email] = result.value;

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

    return ok(user);
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

  public changeEmail(newEmail: string): Result<void, ValidationError> {
    const emailResult = Email.create(newEmail);
    if (isErr(emailResult)) {
      return err(emailResult.error);
    }

    const email = emailResult.value;
    const oldEmail = this.props.email.value;

    // Idempotency check
    if (email.value === oldEmail) {
      return ok();
    }

    this.props = {
      ...this.props,
      email,
      updatedAt: new Date(),
    };

    this.addDomainEvent(
      new UserEmailChangedEvent(
        this._id.value,
        oldEmail,
        email.value,
        this.version + 1,
      ),
    );

    return ok();
  }

  public deactivate(): void {
    if (!this.props.isActive) {
      return;
    }

    this.props = {
      ...this.props,
      isActive: false,
      updatedAt: new Date(),
    };

    this.addDomainEvent(
      new UserDeactivatedEvent(this.id.value, this.version + 1),
    );
  }

  public activate(): void {
    if (this.props.isActive) {
      return;
    }

    this.props = {
      ...this.props,
      isActive: true,
      updatedAt: new Date(),
    };

    this.addDomainEvent(
      new UserActivatedEvent(this.id.value, this.version + 1),
    );
  }

  public changeRole(role: UserRole): void {
    if (this.props.role === role) {
      return;
    }

    const oldRole = this.props.role;

    this.props = {
      ...this.props,
      role,
      updatedAt: new Date(),
    };

    this.addDomainEvent(
      new UserRoleChangedEvent(this.id.value, oldRole, role, this.version + 1),
    );
  }
}
