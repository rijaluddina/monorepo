import type { PersistenceContext } from "@repo/shared";
import type { DrizzleDB } from "./drizzle.client.ts";

export function toPersistenceContext(db: unknown): PersistenceContext {
  return db as unknown as PersistenceContext;
}

export function fromPersistenceContext(ctx: PersistenceContext): DrizzleDB {
  return ctx as unknown as DrizzleDB;
}
