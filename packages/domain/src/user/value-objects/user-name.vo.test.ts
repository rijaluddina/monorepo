import { describe, expect, test } from "bun:test";
import { UserName } from "./user-name.vo.js";
import { isErr, isOk } from "@repo/shared";

describe("UserName Value Object", () => {
  test("should create a valid UserName", () => {
    const nameResult = UserName.create("John", "Doe");
    
    expect(isOk(nameResult)).toBe(true);
    if (isOk(nameResult)) {
      expect(nameResult.value.firstName).toBe("John");
      expect(nameResult.value.lastName).toBe("Doe");
      expect(nameResult.value.fullName).toBe("John Doe");
    }
  });

  test("should trim first and last names", () => {
    const nameResult = UserName.create("  John  ", "  Doe  ");
    
    expect(isOk(nameResult)).toBe(true);
    if (isOk(nameResult)) {
      expect(nameResult.value.firstName).toBe("John");
      expect(nameResult.value.lastName).toBe("Doe");
    }
  });

  test("should fail with empty first name", () => {
    const nameResult = UserName.create("", "Doe");
    expect(isErr(nameResult)).toBe(true);
  });

  test("should fail with empty last name", () => {
    const nameResult = UserName.create("John", "");
    expect(isErr(nameResult)).toBe(true);
  });

  test("should fail with too long first name", () => {
    const nameResult = UserName.create("A".repeat(51), "Doe");
    expect(isErr(nameResult)).toBe(true);
  });

  test("should fail with too long last name", () => {
    const nameResult = UserName.create("John", "A".repeat(51));
    expect(isErr(nameResult)).toBe(true);
  });
});
