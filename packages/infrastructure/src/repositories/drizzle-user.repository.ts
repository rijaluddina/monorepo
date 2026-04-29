import { User, UniqueId, Email, UserName } from "@repo/domain";
import type { IUserRepository } from "@repo/application";
import type { Optional } from "@repo/shared";
import { eq, sql, count } from "drizzle-orm";
import type { DrizzleDB } from "../database/drizzle.client.js";
import { users } from "../database/schema.js";

/**
 * DrizzleUserRepository — implements IUserRepository via Drizzle + PostgreSQL.
 */
export class DrizzleUserRepository implements IUserRepository {
  constructor(private readonly db: DrizzleDB) {}

  async findById(id: string): Promise<Optional<User>> {
    const record = await this.db.query.users.findFirst({
      where: eq(users.id, id),
    });
    if (!record) return undefined;
    return this.toDomain(record);
  }

  async findByEmail(email: string): Promise<Optional<User>> {
    const record = await this.db.query.users.findFirst({
      where: eq(users.email, email),
    });
    if (!record) return undefined;
    return this.toDomain(record);
  }

  async findAll(params?: {
    page?: number;
    limit?: number;
  }): Promise<{ users: User[]; total: number }> {
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 20;
    const offset = (page - 1) * limit;

    const [records, totalResult] = await Promise.all([
      this.db.query.users.findMany({
        limit,
        offset,
        orderBy: (users, { desc }) => [desc(users.createdAt)],
      }),
      this.db.select({ value: count() }).from(users),
    ]);

    const total = Number(totalResult[0]?.value ?? 0);

    return {
      users: records.map((r) => this.toDomain(r)),
      total,
    };
  }

  async save(user: User): Promise<void> {
    await this.db.insert(users).values({
      id: user.id.value,
      firstName: user.name.firstName,
      lastName: user.name.lastName,
      email: user.email.value,
      role: user.role.toUpperCase() as "ADMIN" | "MEMBER" | "VIEWER",
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  }

  async update(user: User): Promise<void> {
    await this.db
      .update(users)
      .set({
        firstName: user.name.firstName,
        lastName: user.name.lastName,
        email: user.email.value,
        role: user.role.toUpperCase() as "ADMIN" | "MEMBER" | "VIEWER",
        isActive: user.isActive,
        updatedAt: user.updatedAt,
      })
      .where(eq(users.id, user.id.value));
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(users).where(eq(users.id, id));
  }

  async existsByEmail(email: string): Promise<boolean> {
    const record = await this.db.query.users.findFirst({
      where: eq(users.email, email),
      columns: { id: true },
    });
    return record !== undefined;
  }

  private toDomain(record: typeof users.$inferSelect): User {
    const name = UserName.create(record.firstName, record.lastName);
    const email = Email.create(record.email);
    const role = record.role.toLowerCase() as "admin" | "member" | "viewer";

    return User.reconstitute(
      {
        name,
        email,
        role,
        isActive: record.isActive,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      },
      new UniqueId(record.id),
    );
  }
}
