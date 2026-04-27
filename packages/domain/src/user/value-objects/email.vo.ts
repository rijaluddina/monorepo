import { ValidationError } from "@repo/shared";
import { ValueObject } from "../../shared/value-object.js";

interface EmailProps {
  value: string;
}

/**
 * Email — Value Object enforcing valid email format.
 */
export class Email extends ValueObject<EmailProps> {
  private static readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  private constructor(props: EmailProps) {
    super(props);
  }

  public static create(email: string): Email {
    return new Email({ value: email.trim().toLowerCase() });
  }

  protected validate(props: EmailProps): void {
    if (!props.value || props.value.trim().length === 0) {
      throw new ValidationError("Email cannot be empty");
    }
    if (!Email.EMAIL_REGEX.test(props.value.trim())) {
      throw new ValidationError(`Invalid email format: "${props.value}"`);
    }
  }

  get value(): string {
    return this.props.value;
  }

  public toString(): string {
    return this.props.value;
  }
}
