import { describe, expect, it } from "bun:test";
import { User } from "@repo/domain";
import { AppError, type Result } from "@repo/shared";
import { DrizzleUserRepository } from "./drizzle-user.repository.ts";

const dbFailure = new Error("database unavailable");
const emptyMessageDbFailure = new AggregateError([
  new Error("connection refused"),
]);

function throwingUserDb() {
  return {
    query: {
      users: {
        findFirst: async () => {
          throw dbFailure;
        },
        findMany: async () => {
          throw dbFailure;
        },
      },
    },
    select: () => ({
      from: async () => {
        throw dbFailure;
      },
    }),
    insert: () => ({
      values: async () => {
        throw dbFailure;
      },
    }),
    update: () => ({
      set: () => ({
        where: async () => {
          throw dbFailure;
        },
      }),
    }),
    delete: () => ({
      where: async () => {
        throw dbFailure;
      },
    }),
  };
}

function emptyMessageUserDb() {
  return {
    query: {
      users: {
        findFirst: async () => {
          throw emptyMessageDbFailure;
        },
      },
    },
  };
}

function createUser() {
  const result = User.create({
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
  });

  if (result.isErr()) throw result.error;
  return result.value;
}

function expectInfrastructureError<T>(result: Result<T, AppError>) {
  expect(result.isErr()).toBe(true);
  if (result.isErr()) {
    expect(result.error).toBeInstanceOf(AppError);
    expect(result.error.code).toBe("INFRASTRUCTURE_ERROR");
    expect(result.error.message).toContain("database unavailable");
  }
}

describe("DrizzleUserRepository", () => {
  it("should return an error when findById database access fails", async () => {
    const repository = new DrizzleUserRepository(
      throwingUserDb() as never,
      {} as never,
    );

    const result = await repository.findById("user-1");

    expectInfrastructureError(result);
  });

  it("should use a fallback message for database errors without a message", async () => {
    const repository = new DrizzleUserRepository(
      emptyMessageUserDb() as never,
      {} as never,
    );

    const result = await repository.findById("user-1");

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toBe("Database operation failed");
    }
  });

  it("should return an error when findByEmail database access fails", async () => {
    const repository = new DrizzleUserRepository(
      throwingUserDb() as never,
      {} as never,
    );

    const result = await repository.findByEmail("ada@example.com");

    expectInfrastructureError(result);
  });

  it("should return an error when findAll database access fails", async () => {
    const repository = new DrizzleUserRepository(
      throwingUserDb() as never,
      {} as never,
    );

    const result = await repository.findAll();

    expectInfrastructureError(result);
  });

  it("should return an error when save database access fails", async () => {
    const repository = new DrizzleUserRepository(
      throwingUserDb() as never,
      {} as never,
    );

    const result = await repository.save(createUser());

    expectInfrastructureError(result);
  });

  it("should return an error when update database access fails", async () => {
    const repository = new DrizzleUserRepository(
      throwingUserDb() as never,
      {} as never,
    );

    const result = await repository.update(createUser());

    expectInfrastructureError(result);
  });

  it("should return an error when delete database access fails", async () => {
    const repository = new DrizzleUserRepository(
      throwingUserDb() as never,
      {} as never,
    );

    const result = await repository.delete("user-1");

    expectInfrastructureError(result);
  });

  it("should return an error when existsByEmail database access fails", async () => {
    const repository = new DrizzleUserRepository(
      throwingUserDb() as never,
      {} as never,
    );

    const result = await repository.existsByEmail("ada@example.com");

    expectInfrastructureError(result);
  });
});
