import { describe, expect, test } from "bun:test";
import { Email } from "./email.vo.js";
import { isErr, isOk } from "@repo/shared";

describe("Email Value Object", () => {
  test("should create a valid email", () => {
    const emailResult = Email.create("test@example.com");
    
    expect(isOk(emailResult)).toBe(true);
    if (isOk(emailResult)) {
      expect(emailResult.value.value).toBe("test@example.com");
    }
  });

  test("should fail with an invalid email format", () => {
    const emailResult = Email.create("invalid-email");
    
    expect(isErr(emailResult)).toBe(true);
  });

  test("should fail with an empty email", () => {
    const emailResult = Email.create("");
    
    expect(isErr(emailResult)).toBe(true);
  });

  test("should normalize email to lowercase and trimmed", () => {
    const emailResult = Email.create("  TEST@Example.COM  ");
    
    expect(isOk(emailResult)).toBe(true);
    if (isOk(emailResult)) {
      expect(emailResult.value.value).toBe("test@example.com");
    }
  });
});
