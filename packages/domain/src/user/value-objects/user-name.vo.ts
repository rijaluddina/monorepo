import { ValidationError } from "@repo/shared";
import { ValueObject } from "../../shared/value-object.js";

interface UserNameProps {
  firstName: string;
  lastName: string;
}

/**
 * UserName — Value Object representing a user's full name.
 */
export class UserName extends ValueObject<UserNameProps> {
  private static readonly MIN_LENGTH = 1;
  private static readonly MAX_LENGTH = 50;

  private constructor(props: UserNameProps) {
    super(props);
  }

  public static create(firstName: string, lastName: string): UserName {
    return new UserName({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
    });
  }

  protected validate(props: UserNameProps): void {
    const { firstName, lastName } = props;
    if (!firstName || firstName.trim().length < UserName.MIN_LENGTH) {
      throw new ValidationError("First name cannot be empty");
    }
    if (firstName.trim().length > UserName.MAX_LENGTH) {
      throw new ValidationError(`First name exceeds max length of ${UserName.MAX_LENGTH}`);
    }
    if (!lastName || lastName.trim().length < UserName.MIN_LENGTH) {
      throw new ValidationError("Last name cannot be empty");
    }
    if (lastName.trim().length > UserName.MAX_LENGTH) {
      throw new ValidationError(`Last name exceeds max length of ${UserName.MAX_LENGTH}`);
    }
  }

  get firstName(): string {
    return this.props.firstName;
  }

  get lastName(): string {
    return this.props.lastName;
  }

  get fullName(): string {
    return `${this.props.firstName} ${this.props.lastName}`;
  }
}
