import path from "node:path";
import { config } from "@dotenvx/dotenvx";
import { defineConfig } from "drizzle-kit";

// Load .env from workspace root
const rootEnvPath = path.resolve(process.cwd(), "../../.env");
config({ path: rootEnvPath, override: true });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is required");
}

export default defineConfig({
  schema: "./src/database/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
