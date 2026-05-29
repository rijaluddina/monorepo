import { describe, expect, it } from "bun:test";
import { envSchema } from "./env-schema.ts";

describe("envSchema", () => {
  // ─── Defaults ───────────────────────────────────────────────────────────

  describe("defaults", () => {
    it("should default NODE_ENV to development", () => {
      const result = envSchema.safeParse({
        DATABASE_URL: "postgres://localhost:5432/db",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.NODE_ENV).toBe("development");
      }
    });

    it("should default REDIS_URL to redis://localhost:6379", () => {
      const result = envSchema.safeParse({
        DATABASE_URL: "postgres://localhost:5432/db",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.REDIS_URL).toBe("redis://localhost:6379");
      }
    });
  });

  // ─── Required fields ────────────────────────────────────────────────────

  describe("required fields", () => {
    it("should fail when DATABASE_URL is missing", () => {
      const result = envSchema.safeParse({});
      expect(result.success).toBe(false);
      if (!result.success) {
        const issues = result.error.issues.filter(
          (i) => i.path[0] === "DATABASE_URL",
        );
        expect(issues.length).toBeGreaterThanOrEqual(1);
      }
    });

    it("should fail when DATABASE_URL is empty string", () => {
      const result = envSchema.safeParse({
        DATABASE_URL: "",
      });
      expect(result.success).toBe(false);
    });

    it("should pass with all required fields set", () => {
      const result = envSchema.safeParse({
        DATABASE_URL: "postgres://localhost:5432/db",
        NODE_ENV: "development",
      });
      expect(result.success).toBe(true);
    });
  });

  // ─── Optional fields (non-production) ───────────────────────────────────

  describe("optional fields (non-production)", () => {
    it("should pass without PORT in development", () => {
      const result = envSchema.safeParse({
        DATABASE_URL: "postgres://localhost:5432/db",
        NODE_ENV: "development",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.PORT).toBeUndefined();
      }
    });

    it("should pass without CORS_ORIGIN in development", () => {
      const result = envSchema.safeParse({
        DATABASE_URL: "postgres://localhost:5432/db",
        NODE_ENV: "development",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.CORS_ORIGIN).toBeUndefined();
      }
    });

    it("should parse PORT as number when provided", () => {
      const result = envSchema.safeParse({
        DATABASE_URL: "postgres://localhost:5432/db",
        PORT: "3000",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.PORT).toBe(3000);
      }
    });

    it("should accept localhost REDIS_URL in development", () => {
      const result = envSchema.safeParse({
        DATABASE_URL: "postgres://localhost:5432/db",
        NODE_ENV: "development",
        REDIS_URL: "redis://localhost:6379",
      });
      expect(result.success).toBe(true);
    });

    it("should accept 127.0.0.1 REDIS_URL in development", () => {
      const result = envSchema.safeParse({
        DATABASE_URL: "postgres://localhost:5432/db",
        NODE_ENV: "development",
        REDIS_URL: "redis://127.0.0.1:6379",
      });
      expect(result.success).toBe(true);
    });

    it("should accept explicit REDIS_URL in development", () => {
      const result = envSchema.safeParse({
        DATABASE_URL: "postgres://localhost:5432/db",
        NODE_ENV: "development",
        REDIS_URL: "redis://redis.example.com:6379",
      });
      expect(result.success).toBe(true);
    });
  });

  // ─── Production checks ──────────────────────────────────────────────────

  describe("production checks", () => {
    it("should fail when PORT is missing in production", () => {
      const result = envSchema.safeParse({
        DATABASE_URL: "postgres://localhost:5432/db",
        NODE_ENV: "production",
        CORS_ORIGIN: "https://app.example.com",
        REDIS_URL: "redis://redis.example.com:6379",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path[0] === "PORT")).toBe(
          true,
        );
      }
    });

    it("should fail when CORS_ORIGIN is missing in production", () => {
      const result = envSchema.safeParse({
        DATABASE_URL: "postgres://localhost:5432/db",
        NODE_ENV: "production",
        PORT: "3000",
        REDIS_URL: "redis://redis.example.com:6379",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some((i) => i.path[0] === "CORS_ORIGIN"),
        ).toBe(true);
      }
    });

    it("should fail when REDIS_URL uses localhost in production", () => {
      const result = envSchema.safeParse({
        DATABASE_URL: "postgres://localhost:5432/db",
        NODE_ENV: "production",
        PORT: "3000",
        CORS_ORIGIN: "https://app.example.com",
        REDIS_URL: "redis://localhost:6379",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path[0] === "REDIS_URL")).toBe(
          true,
        );
      }
    });

    it("should fail when REDIS_URL uses 127.0.0.1 in production", () => {
      const result = envSchema.safeParse({
        DATABASE_URL: "postgres://localhost:5432/db",
        NODE_ENV: "production",
        PORT: "3000",
        CORS_ORIGIN: "https://app.example.com",
        REDIS_URL: "redis://127.0.0.1:6379",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path[0] === "REDIS_URL")).toBe(
          true,
        );
      }
    });

    it("should pass when all production requirements are met", () => {
      const result = envSchema.safeParse({
        DATABASE_URL: "postgres://prod-db:5432/db",
        NODE_ENV: "production",
        PORT: "3000",
        CORS_ORIGIN: "https://app.example.com",
        REDIS_URL: "redis://redis.prod.example.com:6379",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.NODE_ENV).toBe("production");
        expect(result.data.PORT).toBe(3000);
        expect(result.data.CORS_ORIGIN).toBe("https://app.example.com");
        expect(result.data.REDIS_URL).toBe(
          "redis://redis.prod.example.com:6379",
        );
      }
    });

    it("should report multiple issues at once in production", () => {
      // Missing PORT, CORS_ORIGIN, and using localhost REDIS_URL
      const result = envSchema.safeParse({
        DATABASE_URL: "postgres://localhost:5432/db",
        NODE_ENV: "production",
        REDIS_URL: "redis://localhost:6379",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const paths = result.error.issues.map((i) => i.path[0]);
        expect(paths).toContain("PORT");
        expect(paths).toContain("CORS_ORIGIN");
        expect(paths).toContain("REDIS_URL");
      }
    });
  });

  // ─── Type inference ─────────────────────────────────────────────────────

  describe("type inference", () => {
    it("should preserve NODE_ENV as union type", () => {
      // Runtime check that the inferred type works correctly
      const result = envSchema.safeParse({
        DATABASE_URL: "postgres://localhost:5432/db",
        NODE_ENV: "test",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        // Validating that only valid enum values pass
        const validEnvs = ["development", "production", "test"] as const;
        expect(validEnvs.includes(result.data.NODE_ENV)).toBe(true);
      }
    });

    it("should reject invalid NODE_ENV value", () => {
      const result = envSchema.safeParse({
        DATABASE_URL: "postgres://localhost:5432/db",
        NODE_ENV: "staging",
      });
      expect(result.success).toBe(false);
    });
  });
});
