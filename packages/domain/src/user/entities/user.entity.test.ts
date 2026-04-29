import { describe, expect, test } from "bun:test";
import { User } from "./user.entity.js";
import { isOk } from "@repo/shared";
import { UserCreatedEvent } from "../events/user-created.event.js";

describe("User Entity", () => {
  test("should create a user and emit UserCreatedEvent", () => {
    const userResult = User.create({
      firstName: "John",
      lastName: "Doe",
      email: "john.doe@example.com",
    });

    expect(isOk(userResult)).toBe(true);
    
    if (isOk(userResult)) {
      const user = userResult.value;
      expect(user.name.fullName).toBe("John Doe");
      expect(user.email.value).toBe("john.doe@example.com");
      expect(user.role).toBe("member");
      expect(user.isActive).toBe(true);

      const events = user.domainEvents;
      expect(events.length).toBe(1);
      expect(events[0]).toBeInstanceOf(UserCreatedEvent);
      
      const event = events[0] as UserCreatedEvent;
      expect(event.aggregateId).toBe(user.id.value);
      expect(event.name).toBe("John Doe");
      expect(event.email).toBe("john.doe@example.com");
    }
  });

  test("should fail to create a user with invalid email", () => {
    const userResult = User.create({
      firstName: "John",
      lastName: "Doe",
      email: "invalid-email",
    });

    expect(isOk(userResult)).toBe(false);
  });
});
