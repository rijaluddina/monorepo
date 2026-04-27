import "dotenv/config";
import { defineConfig, env } from "prisma/config";
import path from "node:path";
import { config } from "dotenv";

// Manually load .env from root since we are in packages/infrastructure
config({ path: path.resolve(__dirname, "../../.env") });

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
});
