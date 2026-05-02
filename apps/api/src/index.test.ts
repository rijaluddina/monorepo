import { describe, expect, it } from "bun:test";
import { createServer } from "./server";

describe("API Integration Tests", () => {
  const app = createServer();

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
        email: `test-${Date.now()}@example.com`,
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

      expect(response.status).toBe(201);
      const body = (await response.json()) as {
        firstName: string;
        lastName: string;
        email: string;
        role: string;
        id: string;
      };
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
      // 1. Create a user
      const userData = {
        firstName: "Fetch",
        lastName: "ById",
        email: `fetch-${Date.now()}@example.com`,
        role: "member",
      };

      const createResponse = await app.handle(
        new Request("http://localhost/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(userData),
        }),
      );
      const createdUser = (await createResponse.json()) as { id: string };

      // 2. Fetch the user
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

  describe("DELETE /api/users/:id", () => {
    it("should delete a user and make it unavailable via GET", async () => {
      // 1. Create a user
      const userData = {
        firstName: "Delete",
        lastName: "Me",
        email: `delete-${Date.now()}@example.com`,
        role: "viewer",
      };

      const createResponse = await app.handle(
        new Request("http://localhost/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(userData),
        }),
      );
      const createdUser = (await createResponse.json()) as { id: string };

      // 2. Delete the user
      const deleteResponse = await app.handle(
        new Request(`http://localhost/api/users/${createdUser.id}`, {
          method: "DELETE",
        }),
      );
      expect(deleteResponse.status).toBe(204);

      // 3. Verify it's gone
      const getResponse = await app.handle(
        new Request(`http://localhost/api/users/${createdUser.id}`),
      );
      expect(getResponse.status).toBe(404);
    });
  });
});
