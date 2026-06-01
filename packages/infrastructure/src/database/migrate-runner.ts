import path from "node:path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { getDb, getPool } from "./drizzle.client.ts";

const migrationsFolder = path.resolve(process.cwd(), "drizzle");

async function main() {
  console.log("[migrate] Running database migrations...");
  await migrate(getDb(), { migrationsFolder });
  console.log("[migrate] Migrations complete.");
  await getPool().end();
}

main().catch((err) => {
  console.error("[migrate] Migration failed:", err);
  process.exit(1);
});
