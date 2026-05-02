import { describe, expect, it } from "bun:test";
import { USER_CREATED, User } from "@repo/domain";
import { AppError, ConflictError, type Result } from "@repo/shared";
import { DrizzleEventStore } from "./drizzle-event-store.ts";

const dbFailure = new Error("database unavailable");
const emptyMessageDbFailure = new AggregateError([
  new Error("connection refused"),
]);
const uniqueViolation = Object.assign(
  new Error(
    'duplicate key value violates unique constraint "event_store_aggregate_version_idx"',
  ),
  {
    code: "23505",
    constraint: "event_store_aggregate_version_idx",
  },
);

function throwingEventStoreDb() {
  return {
    query: {
      eventStore: {
        findMany: async () => {
          throw dbFailure;
        },
      },
    },
    insert: () => ({
      values: async () => {
        throw dbFailure;
      },
    }),
  };
}

function duplicateVersionDb() {
  return {
    insert: () => ({
      values: async () => {
        throw uniqueViolation;
      },
    }),
  };
}

function emptyMessageEventStoreDb() {
  return {
    query: {
      eventStore: {
        findMany: async () => {
          throw emptyMessageDbFailure;
        },
      },
    },
    insert: () => ({
      values: async () => {
        throw emptyMessageDbFailure;
      },
    }),
  };
}

function capturingInsertDb(capturedValues: object[]) {
  return {
    insert: () => ({
      values: async (values: object[]) => {
        capturedValues.push(...values);
      },
    }),
  };
}

function malformedStoredEventDb() {
  return {
    query: {
      eventStore: {
        findMany: async () => [
          {
            aggregateId: "user-1",
            eventType: 42,
            payload: {},
            version: 1,
            occurredAt: new Date(),
          },
        ],
      },
    },
  };
}

function createEvent() {
  const result = User.create({
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
  });

  if (result.isErr()) throw result.error;
  const event = result.value.domainEvents[0];
  if (!event) throw new Error("Expected user creation event");
  return event;
}

function expectInfrastructureError<T>(result: Result<T, AppError>) {
  expect(result.isErr()).toBe(true);
  if (result.isErr()) {
    expect(result.error).toBeInstanceOf(AppError);
    expect(result.error.code).toBe("INFRASTRUCTURE_ERROR");
    expect(result.error.message).toContain("database unavailable");
  }
}

describe("DrizzleEventStore", () => {
  it("should return an error when append database access fails", async () => {
    const store = new DrizzleEventStore(throwingEventStoreDb() as never);

    const result = await store.append("user-1", [createEvent()]);

    expectInfrastructureError(result);
  });

  it("should use a fallback message for database errors without a message", async () => {
    const store = new DrizzleEventStore(emptyMessageEventStoreDb() as never);

    const result = await store.getEvents("user-1");

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toBe("Database operation failed");
    }
  });

  it("should return a conflict when appending a duplicate aggregate version", async () => {
    const store = new DrizzleEventStore(duplicateVersionDb() as never);

    const result = await store.append("user-1", [createEvent()]);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(ConflictError);
      expect(result.error.code).toBe("CONFLICT");
      expect(result.error.statusCode).toBe(409);
      expect(result.error.message).toContain("Concurrent modification");
    }
  });

  it("should clone event payloads without JSON stringifying Date values", async () => {
    const capturedValues: object[] = [];
    const store = new DrizzleEventStore(
      capturingInsertDb(capturedValues) as never,
    );
    const event = createEvent();

    const result = await store.append("user-1", [event]);

    expect(result.isOk()).toBe(true);
    expect(capturedValues).toHaveLength(1);
    const [inserted] = capturedValues as [{ payload: { occurredAt: unknown } }];
    expect(inserted.payload.occurredAt).toBeInstanceOf(Date);
  });

  it("should reject malformed stored events before returning DomainEvent values", async () => {
    const store = new DrizzleEventStore(malformedStoredEventDb() as never);

    const result = await store.getEvents("user-1");

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("INFRASTRUCTURE_ERROR");
      expect(result.error.message).toContain("Malformed stored event");
    }
  });

  it("should reconstruct stored events with base DomainEvent fields", async () => {
    const occurredAt = new Date();
    const store = new DrizzleEventStore({
      query: {
        eventStore: {
          findMany: async () => [
            {
              aggregateId: "user-1",
              eventType: USER_CREATED,
              payload: {
                firstName: "Ada",
                lastName: "Lovelace",
                email: "ada@example.com",
                role: "member",
              },
              version: 1,
              occurredAt,
            },
          ],
        },
      },
    } as never);

    const result = await store.getEvents("user-1");

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value[0]).toMatchObject({
        aggregateId: "user-1",
        eventType: USER_CREATED,
        occurredAt,
        version: 1,
        firstName: "Ada",
        lastName: "Lovelace",
        email: "ada@example.com",
        role: "member",
      });
    }
  });

  it("should return an error when getEvents database access fails", async () => {
    const store = new DrizzleEventStore(throwingEventStoreDb() as never);

    const result = await store.getEvents("user-1");

    expectInfrastructureError(result);
  });

  it("should return an error when getEventsByType database access fails", async () => {
    const store = new DrizzleEventStore(throwingEventStoreDb() as never);

    const result = await store.getEventsByType("UserCreated");

    expectInfrastructureError(result);
  });
});
