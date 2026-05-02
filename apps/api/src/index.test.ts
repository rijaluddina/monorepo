import { describe, expect, it } from "bun:test";
import { createServer } from "./server";

describe("API Integration Tests", () => {
  const app = createServer();

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
      new Request("http://localhost/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userData),
      }),
    );

    expect(response.status).toBe(201);
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

  describe("POST /api/users", () => {
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
        new Request("http://localhost/api/users", {
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
        new Request("http://localhost/api/users", {
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

  describe("GET /api/users", () => {
    it("should return a list of users", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/users"),
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
  });

  describe("GET /api/users/:id", () => {
    it("should retrieve a user by ID", async () => {
      const userData = {
        firstName: "Fetch",
        lastName: "ById",
        email: `fetch-${Date.now()}-${crypto.randomUUID()}@example.com`,
        role: "member" as const,
      };

      const createdUser = await createUser(userData);

      const response = await app.handle(
        new Request(`http://localhost/api/users/${createdUser.id}`),
      );

      expect(response.status).toBe(200);
      const body = (await response.json()) as { id: string; email: string };
      expect(body.id).toBe(createdUser.id);
      expect(body.email).toBe(userData.email);
    });

    it("should return 404 for non-existent user", async () => {
      const response = await app.handle(
        new Request(
          "http://localhost/api/users/00000000-0000-0000-0000-000000000000",
        ),
      );
      expect(response.status).toBe(404);
    });
  });

  describe("PATCH /api/users/:id", () => {
    it("should activate a deactivated user", async () => {
      const createdUser = await createUser();

      const deactivateResponse = await app.handle(
        new Request(`http://localhost/api/users/${createdUser.id}/deactivate`, {
          method: "PATCH",
        }),
      );
      expect(deactivateResponse.status).toBe(204);

      const activateResponse = await app.handle(
        new Request(`http://localhost/api/users/${createdUser.id}/activate`, {
          method: "PATCH",
        }),
      );
      expect(activateResponse.status).toBe(204);

      const getResponse = await app.handle(
        new Request(`http://localhost/api/users/${createdUser.id}`),
      );
      const body = (await getResponse.json()) as { isActive: boolean };
      expect(body.isActive).toBe(true);
    });

    it("should deactivate an active user", async () => {
      const createdUser = await createUser();

      const response = await app.handle(
        new Request(`http://localhost/api/users/${createdUser.id}/deactivate`, {
          method: "PATCH",
        }),
      );

      expect(response.status).toBe(204);

      const getResponse = await app.handle(
        new Request(`http://localhost/api/users/${createdUser.id}`),
      );
      const body = (await getResponse.json()) as { isActive: boolean };
      expect(body.isActive).toBe(false);
    });

    it("should change a user email", async () => {
      const createdUser = await createUser();
      const newEmail = `changed-${Date.now()}-${crypto.randomUUID()}@example.com`;

      const response = await app.handle(
        new Request(`http://localhost/api/users/${createdUser.id}/email`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: newEmail }),
        }),
      );

      expect(response.status).toBe(204);

      const getResponse = await app.handle(
        new Request(`http://localhost/api/users/${createdUser.id}`),
      );
      const body = (await getResponse.json()) as { email: string };
      expect(body.email).toBe(newEmail);
      expect(body.email).not.toBe(createdUser.email);
    });

    it("should change a user role", async () => {
      const createdUser = await createUser({ role: "member" });

      const response = await app.handle(
        new Request(`http://localhost/api/users/${createdUser.id}/role`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "admin" }),
        }),
      );

      expect(response.status).toBe(204);

      const getResponse = await app.handle(
        new Request(`http://localhost/api/users/${createdUser.id}`),
      );
      const body = (await getResponse.json()) as { role: string };
      expect(body.role).toBe("admin");
    });

    it("should return 409 when changing to an existing email", async () => {
      const existingUser = await createUser();
      const targetUser = await createUser();

      const response = await app.handle(
        new Request(`http://localhost/api/users/${targetUser.id}/email`, {
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
          "http://localhost/api/users/00000000-0000-0000-0000-000000000000/activate",
          { method: "PATCH" },
        ),
      );

      expect(response.status).toBe(404);
    });
  });

  describe("DELETE /api/users/:id", () => {
    it("should delete a user and make it unavailable via GET", async () => {
      const createdUser = await createUser({
        firstName: "Delete",
        lastName: "Me",
        email: `delete-${Date.now()}-${crypto.randomUUID()}@example.com`,
        role: "viewer",
      });

      const deleteResponse = await app.handle(
        new Request(`http://localhost/api/users/${createdUser.id}`, {
          method: "DELETE",
        }),
      );
      expect(deleteResponse.status).toBe(204);

      const getResponse = await app.handle(
        new Request(`http://localhost/api/users/${createdUser.id}`),
      );
      expect(getResponse.status).toBe(404);
    });
  });
});
