import type { IUserRepository } from "@repo/application";
import { Email, UniqueId, User, UserName } from "@repo/domain";
import type { Optional, Result } from "@repo/shared";
import { type AppError, ok } from "@repo/shared";
import { count, eq, sql } from "drizzle-orm";
import type { DrizzleDB } from "../database/drizzle.client.ts";
import { users } from "../database/schema.ts";

/**
 * DrizzleUserRepository — implements IUserRepository via Drizzle + PostgreSQL.
 */
export class DrizzleUserRepository implements IUserRepository {
  constructor(private readonly db: DrizzleDB) {}

  async findById(id: string): Promise<Result<Optional<User>, AppError>> {
    const record = await this.db.query.users.findFirst({
      where: eq(users.id, id),
    });
    if (!record) return ok(undefined);
    return ok(this.toDomain(record));
  }

  async findByEmail(email: string): Promise<Result<Optional<User>, AppError>> {
    const record = await this.db.query.users.findFirst({
      where: eq(users.email, email),
    });
    if (!record) return ok(undefined);
    return ok(this.toDomain(record));
  }

  async findAll(params?: {
    page?: number;
    limit?: number;
  }): Promise<Result<{ users: User[]; total: number }, AppError>> {
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

    return ok({
      users: records.map((r) => this.toDomain(r)),
      total,
    });
  }

  async save(user: User): Promise<Result<void, AppError>> {
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
    return ok();
  }

  async update(user: User): Promise<Result<void, AppError>> {
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
    return ok();
  }

  async delete(id: string): Promise<Result<void, AppError>> {
    await this.db.delete(users).where(eq(users.id, id));
    return ok();
  }

  async existsByEmail(email: string): Promise<Result<boolean, AppError>> {
    const record = await this.db.query.users.findFirst({
      where: eq(users.email, email),
      columns: { id: true },
    });
    return ok(record !== undefined);
  }

  private toDomain(record: typeof users.$inferSelect): User {
    const name = UserName.create(record.firstName, record.lastName).unwrap();
    const email = Email.create(record.email).unwrap();
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
