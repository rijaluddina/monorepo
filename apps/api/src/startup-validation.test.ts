import { describe, expect, it } from "bun:test";
import { spawnSync } from "bun";

/**
 * Startup Validation Order Tests
 *
 * Verifies that when required env vars (e.g. DATABASE_URL) are missing,
 * the envSchema validation in index.ts fails FIRST with a clear error
 * message — BEFORE @repo/infrastructure (drizzle.client.ts) is loaded.
 *
 * These tests spawn index.ts as a subprocess because the module top-level
 * code runs immediately on import. Spawning a child ensures we capture
 * the full startup behavior without affecting the parent process.
 *
 * A regression test with an invalid DATABASE_URL is intentionally omitted
 * because pg.Pool is lazy — it doesn't throw synchronously when given
 * an unreachable connection string, so the subprocess would hang instead
 * of producing a predictable error.
 */
const apiDir = new URL("..", import.meta.url).pathname;

describe("startup validation order", () => {
  it("should fail with env validation error before loading infrastructure when DATABASE_URL is missing", () => {
    // Build env with DATABASE_URL set to empty string so envSchema validation fails
    // Note: We explicitly set DATABASE_URL="" instead of filtering it out because
    // Bun's spawnSync may merge env with the parent process, causing DATABASE_URL
    // to leak through even when excluded from the passed env object.
    const env: Record<string, string> = {
      ...(process.env as Record<string, string>),
      DATABASE_URL: "",
    };

    const result = spawnSync(["bun", "src/index.ts"], {
      cwd: apiDir,
      env,
      timeout: 5_000,
    });

    // Should exit immediately with code 1 (process.exit(1))
    expect(result.exitCode).toBe(1);

    const stderr = result.stderr.toString();

    // Should contain the nice env validation error message
    expect(stderr).toContain("Invalid environment variables");
    expect(stderr).toContain("DATABASE_URL");

    // Should NOT contain drizzle.client.ts error — infrastructure was
    // never loaded because process.exit(1) ran before the dynamic import
    expect(stderr).not.toContain(
      "DATABASE_URL is not defined in environment variables",
    );
  });
});
