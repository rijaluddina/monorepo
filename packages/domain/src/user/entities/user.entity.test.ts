import { describe, expect, test } from "bun:test";
import { isErr, isOk } from "@repo/shared";
import { UserActivatedEvent } from "../events/user-activated.event.ts";
import { UserCreatedEvent } from "../events/user-created.event.ts";
import { UserDeactivatedEvent } from "../events/user-deactivated.event.ts";
import { UserEmailChangedEvent } from "../events/user-email-changed.event.ts";
import { UserRoleChangedEvent } from "../events/user-role-changed.event.ts";
import { User } from "./user.entity.ts";

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

  describe("changeEmail", () => {
    test("should change email and emit UserEmailChangedEvent", () => {
      const user = User.create({
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
      }).unwrap();

      user.clearEvents();

      const result = user.changeEmail("new.email@example.com");
      expect(isOk(result)).toBe(true);
      expect(user.email.value).toBe("new.email@example.com");

      const events = user.domainEvents;
      expect(events.length).toBe(1);
      expect(events[0]).toBeInstanceOf(UserEmailChangedEvent);
      const event = events[0] as UserEmailChangedEvent;
      expect(event.oldEmail).toBe("john.doe@example.com");
      expect(event.newEmail).toBe("new.email@example.com");
    });

    test("should not emit event if email is the same (idempotency)", () => {
      const user = User.create({
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
      }).unwrap();

      user.clearEvents();

      const result = user.changeEmail("john.doe@example.com");
      expect(isOk(result)).toBe(true);
      expect(user.domainEvents.length).toBe(0);
    });

    test("should fail with invalid email", () => {
      const user = User.create({
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
      }).unwrap();

      const result = user.changeEmail("invalid-email");
      expect(isErr(result)).toBe(true);
    });
  });

  describe("activation/deactivation", () => {
    test("should deactivate user and emit UserDeactivatedEvent", () => {
      const user = User.create({
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
      }).unwrap();

      user.clearEvents();
      user.deactivate();

      expect(user.isActive).toBe(false);
      expect(user.domainEvents.length).toBe(1);
      expect(user.domainEvents[0]).toBeInstanceOf(UserDeactivatedEvent);
    });

    test("should not emit event if already deactivated", () => {
      const user = User.create({
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
      }).unwrap();

      user.deactivate();
      user.clearEvents();
      user.deactivate();

      expect(user.domainEvents.length).toBe(0);
    });

    test("should activate user and emit UserActivatedEvent", () => {
      const user = User.create({
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
      }).unwrap();

      user.deactivate();
      user.clearEvents();
      user.activate();

      expect(user.isActive).toBe(true);
      expect(user.domainEvents.length).toBe(1);
      expect(user.domainEvents[0]).toBeInstanceOf(UserActivatedEvent);
    });

    test("should not emit event if already active", () => {
      const user = User.create({
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
      }).unwrap();

      user.clearEvents();
      user.activate();

      expect(user.domainEvents.length).toBe(0);
    });
  });

  describe("changeRole", () => {
    test("should change role and emit UserRoleChangedEvent", () => {
      const user = User.create({
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
        role: "member",
      }).unwrap();

      user.clearEvents();
      user.changeRole("admin");

      expect(user.role).toBe("admin");
      expect(user.domainEvents.length).toBe(1);
      expect(user.domainEvents[0]).toBeInstanceOf(UserRoleChangedEvent);
      const event = user.domainEvents[0] as UserRoleChangedEvent;
      expect(event.oldRole).toBe("member");
      expect(event.newRole).toBe("admin");
    });

    test("should not emit event if role is the same", () => {
      const user = User.create({
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
        role: "member",
      }).unwrap();

      user.clearEvents();
      user.changeRole("member");

      expect(user.domainEvents.length).toBe(0);
    });
  });
});
