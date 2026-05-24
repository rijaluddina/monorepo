import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "@dotenvx/dotenvx";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.ts";

// Load .env from workspace root
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootEnvPath = path.resolve(__dirname, "../../../../.env");
config({ path: rootEnvPath });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not defined in environment variables");
}

export const pool = new pg.Pool({ connectionString: databaseUrl });

export const db = drizzle(pool, { schema });

export type DrizzleDB = typeof db;
