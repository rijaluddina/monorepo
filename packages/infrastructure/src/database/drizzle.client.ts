import "dotenv/config";
import path from "node:path";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";

// Manually load .env from root
const rootEnvPath = path.resolve(import.meta.dirname, "../../../../.env");
config({ path: rootEnvPath });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not defined in environment variables");
}

export const pool = new pg.Pool({ connectionString: databaseUrl });

export const db = drizzle(pool, { schema });

export type DrizzleDB = typeof db;
