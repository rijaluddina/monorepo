import { describe, expect, it } from "bun:test";
import { createServer } from "./server";

describe("API Integration Tests", () => {
  const app = createServer();

  describe("GET /health", () => {
    it("should return 200 and status ok", async () => {
      const response = await app.handle(new Request("http://localhost/health"));
      expect(response.status).toBe(200);
      const body = await response.json();
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
      const body = await response.json();
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
      const response = await app.handle(new Request("http://localhost/api/users"));
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data).toBeArray();
      expect(body.total).toBeDefined();
      expect(body.page).toBeDefined();
      expect(body.limit).toBeDefined();
    });
  });
});
