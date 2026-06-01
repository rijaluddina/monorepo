import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "@dotenvx/dotenvx";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.ts";

// Load .env from workspace root
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootEnvPath = path.resolve(__dirname, "../../../../.env");
config({ path: rootEnvPath, override: true });

// Module-level pool and db for type inference.
// pg.Pool is lazy — no database connection is established until first query.
// Created unconditionally so TypeScript can infer the full DrizzleDB type
// including all table query helpers.
const _modulePool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL ?? "postgresql://localhost:5432/template1",
});
const _moduleDb = drizzle(_modulePool, { schema });

export type DrizzleDB = typeof _moduleDb;

/**
 * getPool — Lazy singleton for the pg.Pool instance.
 * Throws if DATABASE_URL is not set in environment.
 */
export function getPool(): pg.Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not defined in environment variables");
  }
  return _modulePool;
}

/**
 * getDb — Lazy singleton for the Drizzle ORM instance.
 * Throws if DATABASE_URL is not set in environment.
 */
export function getDb(): DrizzleDB {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not defined in environment variables");
  }
  return _moduleDb;
}
