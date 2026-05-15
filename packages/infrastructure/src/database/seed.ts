import { User } from "@repo/domain";
import { db, pool } from "./drizzle.client.ts";
import { eventStore, users as userTable } from "./schema.ts";

async function seed() {
  console.log("🌱 Seeding database...");

  // Clean slate
  await db.delete(eventStore);
  await db.delete(userTable);

  const rawUsers = [
    {
      firstName: "Alice",
      lastName: "Admin",
      email: "alice@example.com",
      role: "ADMIN" as const,
    },
    {
      firstName: "Bob",
      lastName: "Member",
      email: "bob@example.com",
      role: "MEMBER" as const,
    },
    {
      firstName: "Carol",
      lastName: "Viewer",
      email: "carol@example.com",
      role: "VIEWER" as const,
    },
  ];

  for (const u of rawUsers) {
    const user = User.create({
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      role: u.role.toLowerCase() as "admin" | "member" | "viewer",
    }).unwrap();

    // 1. Insert into Read Model
    await db.insert(userTable).values({
      id: user.id.value,
      firstName: user.name.firstName,
      lastName: user.name.lastName,
      email: user.email.value,
      role: u.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      version: user.version,
    });

    // 2. Insert into Event Store (crucial for reconstitution during mutations)
    const events = user.domainEvents.map((e) => ({
      id: crypto.randomUUID(),
      aggregateId: e.aggregateId,
      eventType: e.eventType,
      payload: e,
      version: e.version,
      occurredAt: e.occurredAt,
    }));

    await db.insert(eventStore).values(events);

    console.log(`  ✓ Created ${user.name.fullName} (${user.email.value})`);
  }

  console.log("✅ Seed complete.");
  await pool.end();
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
