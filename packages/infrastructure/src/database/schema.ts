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
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: text("email").notNull(),
    role: userRoleEnum("role").notNull().default("MEMBER"),
    isActive: boolean("is_active").notNull().default(true),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { precision: 3, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { precision: 3, mode: "date" })
      .notNull()
      .defaultNow()
      // Drizzle ORM-side hook only; direct SQL clients bypass this.
      .$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("users_email_key").on(table.email)],
);

// ─── Event Store Table ───────────────────────────────────────────────────────

export const eventStore = pgTable(
  "event_store",
  {
    id: text("id").primaryKey(),
    aggregateId: text("aggregate_id").notNull(),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").notNull(),
    version: integer("version").notNull(),
    occurredAt: timestamp("occurred_at", {
      precision: 3,
      mode: "date",
    }).notNull(),
  },
  (table) => [
    index("event_store_aggregate_id_idx").on(table.aggregateId),
    index("event_store_event_type_idx").on(table.eventType),
    uniqueIndex("event_store_aggregate_version_idx").on(
      table.aggregateId,
      table.version,
    ),
  ],
);
