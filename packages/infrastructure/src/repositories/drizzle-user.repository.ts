import type { IEventStore, IUserRepository } from "@repo/application";
import { Email, UniqueId, User, UserName } from "@repo/domain";
import {
  AppError,
  type Optional,
  type PersistenceContext,
  type Result,
  combine,
  err,
  ok,
} from "@repo/shared";
import { count, eq } from "drizzle-orm";
import type { DrizzleDB } from "../database/drizzle.client.ts";
import { users } from "../database/schema.ts";

/**
 * DrizzleUserRepository — implements IUserRepository via Drizzle + PostgreSQL.
 */
export class DrizzleUserRepository implements IUserRepository {
  constructor(
    private readonly db: DrizzleDB,
    private readonly eventStore: IEventStore,
  ) {}

  private getDb(ctx?: PersistenceContext): DrizzleDB {
    return ctx ? (ctx as unknown as DrizzleDB) : this.db;
  }

  async findById(
    id: string,
    ctx?: PersistenceContext,
  ): Promise<Result<Optional<User>, AppError>> {
    const db = this.getDb(ctx);
    const record = await db.query.users.findFirst({
      where: eq(users.id, id),
    });
    if (!record) return ok(undefined);

    const userResult = this.toDomain(record);
    if (userResult.isErr()) return err(userResult.error);

    return ok(userResult.value);
  }

  async findByEmail(
    email: string,
    ctx?: PersistenceContext,
  ): Promise<Result<Optional<User>, AppError>> {
    const db = this.getDb(ctx);
    const record = await db.query.users.findFirst({
      where: eq(users.email, email),
    });
    if (!record) return ok(undefined);

    const userResult = this.toDomain(record);
    if (userResult.isErr()) return err(userResult.error);

    return ok(userResult.value);
  }

  async findAll(
    params?: {
      page?: number;
      limit?: number;
    },
    ctx?: PersistenceContext,
  ): Promise<Result<{ users: User[]; total: number }, AppError>> {
    const db = this.getDb(ctx);
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 20;
    const offset = (page - 1) * limit;

    const [records, totalResult] = await Promise.all([
      db.query.users.findMany({
        limit,
        offset,
        orderBy: (users, { desc }) => [desc(users.createdAt)],
      }),
      db.select({ value: count() }).from(users),
    ]);

    const total = Number(totalResult[0]?.value ?? 0);

    const usersList: User[] = [];
    for (const r of records) {
      const userResult = this.toDomain(r);
      if (userResult.isErr()) return err(userResult.error);
      usersList.push(userResult.value);
    }

    return ok({
      users: usersList,
      total,
    });
  }

  async save(
    user: User,
    ctx?: PersistenceContext,
  ): Promise<Result<void, AppError>> {
    const db = this.getDb(ctx);
    await db.insert(users).values({
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

  async update(
    user: User,
    ctx?: PersistenceContext,
  ): Promise<Result<void, AppError>> {
    const db = this.getDb(ctx);
    await db
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

  async delete(
    id: string,
    ctx?: PersistenceContext,
  ): Promise<Result<void, AppError>> {
    const db = this.getDb(ctx);
    await db.delete(users).where(eq(users.id, id));
    return ok();
  }

  async existsByEmail(
    email: string,
    ctx?: PersistenceContext,
  ): Promise<Result<boolean, AppError>> {
    const db = this.getDb(ctx);
    const record = await db.query.users.findFirst({
      where: eq(users.email, email),
      columns: { id: true },
    });
    return ok(record !== undefined);
  }

  private toDomain(record: typeof users.$inferSelect): Result<User, AppError> {
    const nameResult = UserName.create(record.firstName, record.lastName);
    const emailResult = Email.create(record.email);

    const result = combine<[UserName, Email], AppError>([
      nameResult as Result<UserName, AppError>,
      emailResult as Result<Email, AppError>,
    ]);
    if (result.isErr()) return err(result.error);

    const [name, email] = result.value;
    const role = record.role.toLowerCase() as "admin" | "member" | "viewer";

    return ok(
      User.reconstitute(
        {
          name,
          email,
          role,
          isActive: record.isActive,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        },
        new UniqueId(record.id),
      ),
    );
  }
}
