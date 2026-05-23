import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import {
  createAppContainer,
  startOutboxProcessor,
  stopOutboxProcessor,
} from "@repo/infrastructure";
import { createServer } from "./server";

process.env.NODE_ENV = "test";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("API Integration Tests", () => {
  const container = createAppContainer();
  const app = createServer(container);

  beforeAll(() => {
    startOutboxProcessor(container, 20); // Fast interval for tests
  });

  afterAll(() => {
    stopOutboxProcessor();
  });

  async function createUser(
    overrides: Partial<{
      firstName: string;
      lastName: string;
      email: string;
      role: "admin" | "member" | "viewer";
    }> = {},
  ) {
    const userData = {
      firstName: "Integration",
      lastName: "Test",
      email: `test-${Date.now()}-${crypto.randomUUID()}@example.com`,
      role: "member" as const,
      ...overrides,
    };

    const response = await app.handle(
      new Request("http://localhost/api/v1/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userData),
      }),
    );

    expect(response.status).toBe(201);
    await sleep(50); // wait for outbox processor
    return (await response.json()) as {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      role: string;
      isActive: boolean;
    };
  }

  describe("GET /health", () => {
    it("should return 200 and status ok", async () => {
      const response = await app.handle(new Request("http://localhost/health"));
      expect(response.status).toBe(200);
      const body = (await response.json()) as { status: string };
      expect(body.status).toBe("ok");
    });
  });

  describe("POST /api/v1/users", () => {
    it("should create a new user and return 201", async () => {
      const userData = {
        firstName: "Integration",
        lastName: "Test",
        email: `test-${Date.now()}-${crypto.randomUUID()}@example.com`,
        role: "member" as const,
      };

      const body = await createUser(userData);

      expect(body.firstName).toBe(userData.firstName);
      expect(body.lastName).toBe(userData.lastName);
      expect(body.email).toBe(userData.email);
      expect(body.role).toBe(userData.role);
      expect(body.id).toBeDefined();
    });

    it("should return 422 for invalid email", async () => {
      const userData = {
        firstName: "Integration",
        lastName: "Test",
        email: "invalid-email",
        role: "member",
      };

      const response = await app.handle(
        new Request("http://localhost/api/v1/users", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(userData),
        }),
      );

      // Elysia returns 422 for validation errors by default
      expect(response.status).toBe(422);
    });

    it("should return 422 for missing required fields", async () => {
      const userData = {
        firstName: "Integration",
        // lastName is missing
        email: "test@example.com",
      };

      const response = await app.handle(
        new Request("http://localhost/api/v1/users", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(userData),
        }),
      );

      expect(response.status).toBe(422);
    });
  });

  describe("GET /api/v1/users", () => {
    it("should return a list of users", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/v1/users"),
      );
      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        data: unknown[];
        total: unknown;
        page: unknown;
        limit: unknown;
      };
      expect(body.data).toBeArray();
      expect(body.total).toBeDefined();
      expect(body.page).toBeDefined();
      expect(body.limit).toBeDefined();
    });

    it("should search users by first name", async () => {
      const uniqueSuffix = `srch-${Date.now()}`;
      await createUser({
        firstName: uniqueSuffix,
        lastName: "SearchTest",
        email: `${uniqueSuffix}@example.com`,
        role: "member",
      });

      const response = await app.handle(
        new Request(`http://localhost/api/v1/users?search=${uniqueSuffix}`),
      );
      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        data: { firstName: string }[];
        total: number;
      };
      expect(body.total).toBeGreaterThanOrEqual(1);
      expect(body.data.some((u) => u.firstName === uniqueSuffix)).toBe(true);
    });

    it("should search users by last name", async () => {
      const uniqueSuffix = `ln-${Date.now()}`;
      await createUser({
        firstName: "Dummy",
        lastName: uniqueSuffix,
        email: `${uniqueSuffix}@example.com`,
        role: "member",
      });

      const response = await app.handle(
        new Request(`http://localhost/api/v1/users?search=${uniqueSuffix}`),
      );
      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        data: { lastName: string }[];
        total: number;
      };
      expect(body.total).toBeGreaterThanOrEqual(1);
      expect(body.data.some((u) => u.lastName === uniqueSuffix)).toBe(true);
    });

    it("should search users by email", async () => {
      const uniqueSuffix = `email-${Date.now()}`;
      const email = `${uniqueSuffix}@find-me.com`;
      await createUser({
        firstName: "EmailSearch",
        lastName: "Test",
        email,
        role: "viewer",
      });

      const response = await app.handle(
        new Request(
          `http://localhost/api/v1/users?search=${uniqueSuffix}%40find-me.com`,
        ),
      );
      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        data: { email: string }[];
        total: number;
      };
      expect(body.total).toBeGreaterThanOrEqual(1);
      expect(body.data.some((u) => u.email === email)).toBe(true);
    });

    it("should return empty results for a non-matching search", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/v1/users?search=ZZZZNONEXISTENTZZZZ"),
      );
      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        data: unknown[];
        total: number;
      };
      expect(body.data).toBeArray();
      expect(body.total).toBe(0);
      expect(body.data).toHaveLength(0);
    });

    it("should perform case-insensitive search", async () => {
      const uniqueSuffix = `CaseTest-${Date.now()}`;
      await createUser({
        firstName: uniqueSuffix,
        lastName: "CI",
        email: `${uniqueSuffix.toLowerCase()}@case-test.com`,
        role: "member",
      });

      // Search with lowercase
      const response = await app.handle(
        new Request(
          `http://localhost/api/v1/users?search=${uniqueSuffix.toLowerCase()}`,
        ),
      );
      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        data: { firstName: string }[];
        total: number;
      };
      expect(body.total).toBeGreaterThanOrEqual(1);
      expect(body.data.some((u) => u.firstName === uniqueSuffix)).toBe(true);
    });
  });

  describe("GET /api/v1/users/:id", () => {
    it("should retrieve a user by ID", async () => {
      const userData = {
        firstName: "Fetch",
        lastName: "ById",
        email: `fetch-${Date.now()}-${crypto.randomUUID()}@example.com`,
        role: "member" as const,
      };

      const createdUser = await createUser(userData);

      const response = await app.handle(
        new Request(`http://localhost/api/v1/users/${createdUser.id}`),
      );

      expect(response.status).toBe(200);
      const body = (await response.json()) as { id: string; email: string };
      expect(body.id).toBe(createdUser.id);
      expect(body.email).toBe(userData.email);
    });

    it("should return 404 for non-existent user", async () => {
      const response = await app.handle(
        new Request(
          "http://localhost/api/v1/users/00000000-0000-0000-0000-000000000000",
        ),
      );
      expect(response.status).toBe(404);
    });
  });

  describe("PATCH /api/v1/users/:id", () => {
    it("should activate a deactivated user", async () => {
      const createdUser = await createUser();

      const deactivateResponse = await app.handle(
        new Request(
          `http://localhost/api/v1/users/${createdUser.id}/deactivate`,
          {
            method: "PATCH",
          },
        ),
      );
      expect(deactivateResponse.status).toBe(204);
      await sleep(50);

      const activateResponse = await app.handle(
        new Request(
          `http://localhost/api/v1/users/${createdUser.id}/activate`,
          {
            method: "PATCH",
          },
        ),
      );
      expect(activateResponse.status).toBe(204);
      await sleep(50);

      const getResponse = await app.handle(
        new Request(`http://localhost/api/v1/users/${createdUser.id}`),
      );
      const body = (await getResponse.json()) as { isActive: boolean };
      expect(body.isActive).toBe(true);
    });

    it("should deactivate an active user", async () => {
      const createdUser = await createUser();

      const response = await app.handle(
        new Request(
          `http://localhost/api/v1/users/${createdUser.id}/deactivate`,
          {
            method: "PATCH",
          },
        ),
      );

      expect(response.status).toBe(204);
      await sleep(50);

      const getResponse = await app.handle(
        new Request(`http://localhost/api/v1/users/${createdUser.id}`),
      );
      const body = (await getResponse.json()) as { isActive: boolean };
      expect(body.isActive).toBe(false);
    });

    it("should change a user email", async () => {
      const createdUser = await createUser();
      const newEmail = `changed-${Date.now()}-${crypto.randomUUID()}@example.com`;

      const response = await app.handle(
        new Request(`http://localhost/api/v1/users/${createdUser.id}/email`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: newEmail }),
        }),
      );

      expect(response.status).toBe(204);
      await sleep(50);

      const getResponse = await app.handle(
        new Request(`http://localhost/api/v1/users/${createdUser.id}`),
      );
      const body = (await getResponse.json()) as { email: string };
      expect(body.email).toBe(newEmail);
      expect(body.email).not.toBe(createdUser.email);
    });

    it("should change a user role", async () => {
      const createdUser = await createUser({ role: "member" });

      const response = await app.handle(
        new Request(`http://localhost/api/v1/users/${createdUser.id}/role`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "admin" }),
        }),
      );

      expect(response.status).toBe(204);
      await sleep(50);

      const getResponse = await app.handle(
        new Request(`http://localhost/api/v1/users/${createdUser.id}`),
      );
      const body = (await getResponse.json()) as { role: string };
      expect(body.role).toBe("admin");
    });

    it("should return 409 when changing to an existing email", async () => {
      const existingUser = await createUser();
      const targetUser = await createUser();

      const response = await app.handle(
        new Request(`http://localhost/api/v1/users/${targetUser.id}/email`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: existingUser.email }),
        }),
      );

      expect(response.status).toBe(409);
    });

    it("should return 404 when activating a non-existent user", async () => {
      const response = await app.handle(
        new Request(
          "http://localhost/api/v1/users/00000000-0000-0000-0000-000000000000/activate",
          { method: "PATCH" },
        ),
      );

      expect(response.status).toBe(404);
    });
  });

  describe("DELETE /api/v1/users/:id", () => {
    it("should delete a user and make it unavailable via GET", async () => {
      const createdUser = await createUser({
        firstName: "Delete",
        lastName: "Me",
        email: `delete-${Date.now()}-${crypto.randomUUID()}@example.com`,
        role: "viewer",
      });

      const deleteResponse = await app.handle(
        new Request(`http://localhost/api/v1/users/${createdUser.id}`, {
          method: "DELETE",
        }),
      );
      expect(deleteResponse.status).toBe(204);
      await sleep(50);

      const getResponse = await app.handle(
        new Request(`http://localhost/api/v1/users/${createdUser.id}`),
      );
      expect(getResponse.status).toBe(404);
    });

    it("should return 409 when deleting an already deleted user", async () => {
      const createdUser = await createUser({
        firstName: "DeleteAgain",
        lastName: "Test",
        email: `delete-again-${Date.now()}-${crypto.randomUUID()}@example.com`,
        role: "viewer",
      });

      // First delete — should succeed
      const firstDelete = await app.handle(
        new Request(`http://localhost/api/v1/users/${createdUser.id}`, {
          method: "DELETE",
        }),
      );
      expect(firstDelete.status).toBe(204);
      await sleep(50);

      // Second delete — should fail with 409 Conflict
      const secondDelete = await app.handle(
        new Request(`http://localhost/api/v1/users/${createdUser.id}`, {
          method: "DELETE",
        }),
      );
      expect(secondDelete.status).toBe(409);
    });
  });

  describe("PATCH /api/v1/users/:id/restore", () => {
    it("should restore a deleted user and preserve all properties", async () => {
      const createdUser = await createUser({
        firstName: "Restore",
        lastName: "Me",
        email: `restore-${Date.now()}-${crypto.randomUUID()}@example.com`,
        role: "viewer",
      });

      // Save properties before deletion
      const originalProps = {
        firstName: createdUser.firstName,
        lastName: createdUser.lastName,
        email: createdUser.email,
        role: createdUser.role,
        isActive: createdUser.isActive,
      };

      // Delete the user
      const deleteResponse = await app.handle(
        new Request(`http://localhost/api/v1/users/${createdUser.id}`, {
          method: "DELETE",
        }),
      );
      expect(deleteResponse.status).toBe(204);
      await sleep(50);

      // Verify it's deleted (404)
      const getBeforeRestore = await app.handle(
        new Request(`http://localhost/api/v1/users/${createdUser.id}`),
      );
      expect(getBeforeRestore.status).toBe(404);

      // Restore the user
      const restoreResponse = await app.handle(
        new Request(`http://localhost/api/v1/users/${createdUser.id}/restore`, {
          method: "PATCH",
        }),
      );
      expect(restoreResponse.status).toBe(204);
      await sleep(50);

      // Verify it's accessible again with all properties preserved
      const getAfterRestore = await app.handle(
        new Request(`http://localhost/api/v1/users/${createdUser.id}`),
      );
      expect(getAfterRestore.status).toBe(200);
      const body = (await getAfterRestore.json()) as {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
        role: string;
        isActive: boolean;
      };

      expect(body.id).toBe(createdUser.id);
      expect(body.firstName).toBe(originalProps.firstName);
      expect(body.lastName).toBe(originalProps.lastName);
      expect(body.email).toBe(originalProps.email);
      expect(body.role).toBe(originalProps.role);
      expect(body.isActive).toBe(originalProps.isActive);
    });

    it("should return 204 when restoring an active (non-deleted) user", async () => {
      const createdUser = await createUser({
        firstName: "RestoreNoop",
        lastName: "Test",
        email: `restore-noop-${Date.now()}-${crypto.randomUUID()}@example.com`,
        role: "admin",
      });

      // Restore an active user — domain logic is a no-op, returns 204
      const restoreResponse = await app.handle(
        new Request(`http://localhost/api/v1/users/${createdUser.id}/restore`, {
          method: "PATCH",
        }),
      );
      expect(restoreResponse.status).toBe(204);
      await sleep(50);

      // User should still be accessible and unchanged
      const getResponse = await app.handle(
        new Request(`http://localhost/api/v1/users/${createdUser.id}`),
      );
      expect(getResponse.status).toBe(200);
      const body = (await getResponse.json()) as {
        id: string;
        firstName: string;
        isActive: boolean;
      };
      expect(body.id).toBe(createdUser.id);
      expect(body.firstName).toBe("RestoreNoop");
    });

    it("should return 404 when restoring a non-existent user", async () => {
      const response = await app.handle(
        new Request(
          "http://localhost/api/v1/users/00000000-0000-0000-0000-000000000000/restore",
          {
            method: "PATCH",
          },
        ),
      );

      expect(response.status).toBe(404);
    });
  });
});
