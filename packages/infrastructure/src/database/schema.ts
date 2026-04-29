import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ─── User Role Enum ──────────────────────────────────────────────────────────

export const userRoleEnum = pgEnum("user_role", ["ADMIN", "MEMBER", "VIEWER"]);

// ─── User Table ──────────────────────────────────────────────────────────────

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    firstName: text("firstName").notNull(),
    lastName: text("lastName").notNull(),
    email: text("email").notNull(),
    role: userRoleEnum("role").notNull().default("MEMBER"),
    isActive: boolean("isActive").notNull().default(true),
    createdAt: timestamp("createdAt", { precision: 3, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updatedAt", { precision: 3, mode: "date" })
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("users_email_key").on(table.email)],
);

// ─── Event Store Table ───────────────────────────────────────────────────────

export const eventStore = pgTable(
  "event_store",
  {
    id: text("id").primaryKey(),
    aggregateId: text("aggregateId").notNull(),
    eventType: text("eventType").notNull(),
    payload: jsonb("payload").notNull(),
    version: integer("version").notNull(),
    occurredAt: timestamp("occurredAt", {
      precision: 3,
      mode: "date",
    }).notNull(),
  },
  (table) => [
    index("event_store_aggregateId_idx").on(table.aggregateId),
    index("event_store_eventType_idx").on(table.eventType),
  ],
);
