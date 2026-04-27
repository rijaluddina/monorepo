import { prisma } from "../database/prisma.client.js";
import { User } from "@repo/domain";

async function seed() {
  console.log("🌱 Seeding database...");

  // Clean slate
  await prisma.eventStoreEntry.deleteMany();
  await prisma.user.deleteMany();

  const users = [
    { firstName: "Alice", lastName: "Admin", email: "alice@example.com", role: "ADMIN" as const },
    { firstName: "Bob", lastName: "Member", email: "bob@example.com", role: "MEMBER" as const },
    { firstName: "Carol", lastName: "Viewer", email: "carol@example.com", role: "VIEWER" as const },
  ];

  for (const u of users) {
    const user = User.create({
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      role: u.role.toLowerCase() as "admin" | "member" | "viewer",
    });

    await prisma.user.create({
      data: {
        id: user.id.value,
        firstName: user.name.firstName,
        lastName: user.name.lastName,
        email: user.email.value,
        role: u.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });

    console.log(`  ✓ Created ${user.name.fullName} (${user.email.value})`);
  }

  console.log("✅ Seed complete.");
  await prisma.$disconnect();
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
