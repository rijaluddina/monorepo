import path from "node:path";
import { config } from "@dotenvx/dotenvx";
import { defineConfig } from "drizzle-kit";

// Load .env from workspace root
const rootEnvPath = path.resolve(process.cwd(), "../../.env");
config({ path: rootEnvPath, override: true });

export default defineConfig({
  schema: "./src/database/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL as string,
  },
});
