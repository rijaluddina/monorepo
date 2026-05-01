import { describe, expect, it } from "bun:test";
import { UniqueId } from "../../shared/identifier.ts";
import { User } from "./user.entity.ts";
import { UserCreatedEvent } from "../events/user-created.event.ts";
import { UserEmailChangedEvent } from "../events/user-email-changed.event.ts";
import { UserName } from "../value-objects/user-name.vo.ts";
import { Email } from "../value-objects/email.vo.ts";

describe("User Aggregate Reconstitution", () => {
  it("should reconstitute user from events", () => {
    const userId = new UniqueId();
    const name = UserName.create("John", "Doe").value as UserName;
    const email = Email.create("john@example.com").value as Email;
    const role = "member";

    const events = [
      new UserCreatedEvent(userId.value, name, email, role, 1),
      new UserEmailChangedEvent(userId.value, "john@example.com", "john.doe@example.com", 2),
    ];

    const user = User.fromEvents(events, userId);

    expect(user.id.equals(userId)).toBe(true);
    expect(user.name.firstName).toBe("John");
    expect(user.name.lastName).toBe("Doe");
    expect(user.email.value).toBe("john.doe@example.com");
    expect(user.role).toBe("member");
    expect(user.version).toBe(2);
  });
});
