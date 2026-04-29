import "dotenv/config";
import path from "node:path";
import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Manually load .env from root
const rootEnvPath = path.resolve(import.meta.dirname, "../../.env");
config({ path: rootEnvPath });

export default defineConfig({
  schema: "./src/database/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
