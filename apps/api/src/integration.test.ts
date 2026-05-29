/**
 * E2E Integration Test — API + Database + Outbox
 *
 * Tests the full user lifecycle through the HTTP API, verifying:
 *   - Command/query flow via Elysia route handlers
 *   - Event store records domain events
 *   - Outbox table records events from command handlers
 *   - Outbox processing: publish, failure retry, batch processing
 *
 * Uses its OWN pg.Pool + drizzle instance (via createIsolatedDb()) so that
 * index.test.ts's graceful shutdown test (which ends the singleton pool)
 * doesn't affect this suite.
 *
 * Outbox processing now works here thanks to the processOutbox() helper
 * that accepts an optional customDb parameter (see processor.ts).
 *
 * @see index.test.ts — comprehensive per-endpoint tests
 */

import { afterAll, describe, expect, it } from "bun:test";
import { eventStore, outbox } from "@repo/infrastructure";
import { err, ok } from "@repo/shared";
import { eq } from "drizzle-orm";
import {
  createIsolatedDb,
  createMockExternalBus,
  createTestContainer,
  createUserViaApi,
  processOutboxWithDb,
} from "./test-helpers";

process.env.NODE_ENV = "test";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("E2E: API + Database + Outbox", () => {
  const { pool, db } = createIsolatedDb();
  const { container, app } = createTestContainer(db);

  afterAll(async () => {
    await pool.end();
  });

  const api = {
    createUser: (overrides?: Parameters<typeof createUserViaApi>[1]) =>
      createUserViaApi(app, overrides),
    getUser: (id: string) =>
      app.handle(new Request(`http://localhost/api/v1/users/${id}`)),
    patch: (path: string, body?: Record<string, unknown>) =>
      app.handle(
        new Request(`http://localhost/api/v1/users/${path}`, {
          method: "PATCH",
          headers: body ? { "Content-Type": "application/json" } : undefined,
          body: body ? JSON.stringify(body) : undefined,
        }),
      ),
    delete: (id: string) =>
      app.handle(
        new Request(`http://localhost/api/v1/users/${id}`, {
          method: "DELETE",
        }),
      ),
  };

  // ── Full User Lifecycle ────────────────────────────────────────────────

  it("should create, read, update email, delete, and restore a user", async () => {
    const { response: createRes, body: created } = await api.createUser({
      firstName: "Lifecycle",
      lastName: "Test",
      role: "viewer",
    });
    expect(createRes.status).toBe(201);
    expect(created.firstName).toBe("Lifecycle");
    expect(created.lastName).toBe("Test");
    expect(created.role).toBe("viewer");
    expect(created.isActive).toBe(true);

    // Read by ID
    const getRes = await api.getUser(created.id);
    expect(getRes.status).toBe(200);
    const fetched = (await getRes.json()) as { email: string };
    expect(fetched.email).toBe(created.email);

    // Update email
    const newEmail = `lc-${Date.now()}-x@example.com`;
    const emailRes = await api.patch(`${created.id}/email`, {
      email: newEmail,
    });
    expect(emailRes.status).toBe(204);
    await sleep(50);

    const afterEmail = await api.getUser(created.id);
    expect(((await afterEmail.json()) as { email: string }).email).toBe(
      newEmail,
    );

    // Delete
    const delRes = await api.delete(created.id);
    expect(delRes.status).toBe(204);
    await sleep(50);
    expect((await api.getUser(created.id)).status).toBe(404);

    // Restore
    const restRes = await api.patch(`${created.id}/restore`);
    expect(restRes.status).toBe(204);
    await sleep(50);

    const restored = await api.getUser(created.id);
    expect(restored.status).toBe(200);
    const restoredBody = (await restored.json()) as {
      id: string;
      isActive: boolean;
    };
    expect(restoredBody.id).toBe(created.id);
    expect(restoredBody.isActive).toBe(true);
  });

  // ── Event Store ─────────────────────────────────────────────────────────

  it("should record domain events in the event store", async () => {
    const email = `es-${Date.now()}@example.com`;
    const { body: user, response } = await api.createUser({ email });
    expect(response.status).toBe(201);
    await sleep(50);

    const events = await db
      .select()
      .from(eventStore)
      .where(eq(eventStore.aggregateId, user.id))
      .orderBy(eventStore.version);

    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0]?.eventType).toBe("UserCreated");
    expect(events[0]?.aggregateId).toBe(user.id);
    expect(events[0]?.version).toBe(1);
    expect(events[0]?.occurredAt).toBeInstanceOf(Date);

    // Change email
    const newEmail = `es2-${Date.now()}@example.com`;
    await api.patch(`${user.id}/email`, { email: newEmail });
    await sleep(50);

    const afterChange = await db
      .select()
      .from(eventStore)
      .where(eq(eventStore.aggregateId, user.id))
      .orderBy(eventStore.version);

    expect(afterChange.length).toBeGreaterThanOrEqual(2);
    const emailChanged = afterChange.find(
      (e) => e.eventType === "UserEmailChanged",
    );
    expect(emailChanged).toBeDefined();
    expect(emailChanged?.payload).toHaveProperty("newEmail", newEmail);
  });

  // ── Outbox Table Writes ────────────────────────────────────────────────

  it("should write outbox rows on user creation", async () => {
    const { body: user } = await api.createUser();
    await sleep(50);

    const rows = await db
      .select()
      .from(outbox)
      .where(eq(outbox.aggregateId, user.id));

    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0]?.eventType).toBe("UserCreated");
    expect(rows[0]?.retryCount).toBe(0);
  });

  it("should write outbox rows for multiple operations on the same user", async () => {
    const { body: user } = await api.createUser();
    await sleep(50);

    await api.patch(`${user.id}/deactivate`);
    await sleep(50);
    await api.patch(`${user.id}/activate`);
    await sleep(50);
    await api.patch(`${user.id}/email`, { email: `mo-${Date.now()}@x.com` });
    await sleep(50);

    const rows = await db
      .select()
      .from(outbox)
      .where(eq(outbox.aggregateId, user.id));

    const eventTypes = rows.map((r) => r.eventType);
    expect(eventTypes).toContain("UserCreated");
    expect(eventTypes).toContain("UserDeactivated");
    expect(eventTypes).toContain("UserActivated");
    expect(eventTypes).toContain("UserEmailChanged");
  });

  // ── Event Store Chronological Ordering ─────────────────────────────────

  it("should record event store entries in chronological order", async () => {
    const { body: user } = await api.createUser();

    await api.patch(`${user.id}/deactivate`);
    await sleep(30);
    await api.patch(`${user.id}/activate`);
    await sleep(30);
    await api.delete(user.id);
    await sleep(30);
    await api.patch(`${user.id}/restore`);
    await sleep(50);

    const events = await db
      .select()
      .from(eventStore)
      .where(eq(eventStore.aggregateId, user.id))
      .orderBy(eventStore.version);

    for (let i = 1; i < events.length; i++) {
      expect(events[i]?.version).toBeGreaterThan(events[i - 1]?.version ?? 0);
      expect(
        (events[i]?.occurredAt?.getTime() ?? 0) >=
          (events[i - 1]?.occurredAt?.getTime() ?? 0),
      ).toBe(true);
    }

    const eventTypes = events.map((e) => e.eventType);
    expect(eventTypes).toContain("UserCreated");
    expect(eventTypes).toContain("UserDeactivated");
    expect(eventTypes).toContain("UserActivated");
    expect(eventTypes).toContain("UserDeleted");
    expect(eventTypes).toContain("USER_RESTORED");
  });

  // ── Outbox Processing — with custom pool via test helper ───────────────

  describe("Outbox Processing via custom pool", () => {
    it("should publish events to external bus and delete outbox rows on success", async () => {
      const mockBus = createMockExternalBus(ok(undefined));

      const { body: user } = await api.createUser();
      await sleep(50);

      // Verify outbox has row
      const beforeRows = await db
        .select()
        .from(outbox)
        .where(eq(outbox.aggregateId, user.id));
      expect(beforeRows.length).toBeGreaterThanOrEqual(1);
      expect(beforeRows[0]?.eventType).toBe("UserCreated");
      const expectedCreatedAt = beforeRows[0]?.createdAt;
      const expectedVersion =
        (beforeRows[0]?.payload as { version?: number })?.version ?? 1;

      // Process outbox with our custom db + mock bus
      await processOutboxWithDb({ externalEventBus: mockBus } as never, db);

      // Verify our user's event WAS published (may be mixed with stale rows)
      expect(mockBus.publishedEvents.length).toBeGreaterThanOrEqual(1);
      const ourEvent = mockBus.publishedEvents.find(
        (e) => e.aggregateId === user.id,
      );
      expect(ourEvent).toBeDefined();
      expect(ourEvent?.eventType).toBe("UserCreated");
      expect(ourEvent?.version).toBe(expectedVersion);
      if (expectedCreatedAt && ourEvent?.occurredAt) {
        expect(ourEvent.occurredAt.getTime()).toBe(expectedCreatedAt.getTime());
      }

      // Verify OUR user's outbox row was deleted
      const afterRows = await db
        .select()
        .from(outbox)
        .where(eq(outbox.aggregateId, user.id));
      expect(afterRows.length).toBe(0);
    });

    it("should increment retry count when publish fails", async () => {
      const mockBus = createMockExternalBus(err(new Error("Network error")));

      const { body: user } = await api.createUser();
      await sleep(50);

      // Process outbox with failing mock
      await processOutboxWithDb({ externalEventBus: mockBus } as never, db);

      // Verify retry count incremented
      const rows = await db
        .select()
        .from(outbox)
        .where(eq(outbox.aggregateId, user.id));
      expect(rows.length).toBeGreaterThanOrEqual(1);
      expect(rows[0]?.retryCount).toBe(1);
      expect(rows[0]?.lastError).toBe("Network error");
      expect(rows[0]?.nextRetryAt).toBeDefined();

      // Clean up
      if (rows[0]) {
        await db.delete(outbox).where(eq(outbox.id, rows[0].id));
      }
    });

    it("should process multiple outbox rows in a single batch", async () => {
      const mockBus = createMockExternalBus(ok(undefined));

      // Create a user, then perform multiple operations
      const { body: user } = await api.createUser();
      await sleep(50);
      await api.patch(`${user.id}/deactivate`);
      await sleep(50);
      await api.patch(`${user.id}/activate`);
      await sleep(50);

      // Process outbox (batch of 3 rows)
      await processOutboxWithDb({ externalEventBus: mockBus } as never, db);

      const publishedTypes = mockBus.publishedEvents.map((e) => e.eventType);
      expect(publishedTypes).toContain("UserCreated");
      expect(publishedTypes).toContain("UserDeactivated");
      expect(publishedTypes).toContain("UserActivated");

      // All rows should be deleted
      const rows = await db
        .select()
        .from(outbox)
        .where(eq(outbox.aggregateId, user.id));
      expect(rows.length).toBe(0);
    });

    it("should record events in chronological order after processing", async () => {
      const mockBus = createMockExternalBus(ok(undefined));

      // Create user with multiple operations
      const { body: user } = await api.createUser();
      await sleep(30);
      await api.patch(`${user.id}/deactivate`);
      await sleep(30);
      await api.patch(`${user.id}/activate`);
      await sleep(30);
      await api.patch(`${user.id}/email`, { email: `co-${Date.now()}@x.com` });
      await sleep(50);

      // Process all 4 events
      await processOutboxWithDb({ externalEventBus: mockBus } as never, db);

      // Filter to our user's events (stale rows from previous tests may exist)
      const ourEvents = mockBus.publishedEvents.filter(
        (e) => e.aggregateId === user.id,
      );

      // Verify chronological order
      for (let i = 1; i < ourEvents.length; i++) {
        expect(ourEvents[i]?.version).toBeGreaterThan(
          ourEvents[i - 1]?.version ?? 0,
        );
        expect(
          (ourEvents[i]?.occurredAt?.getTime() ?? 0) >=
            (ourEvents[i - 1]?.occurredAt?.getTime() ?? 0),
        ).toBe(true);
      }
    });
  });
});
