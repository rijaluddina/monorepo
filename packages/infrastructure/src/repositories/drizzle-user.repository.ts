import type { IEventStore, IUserRepository } from "@repo/application";
import { Email, UniqueId, User, UserName } from "@repo/domain";
import {
  AppError,
  ConflictError,
  NotFoundError,
  type Optional,
  type PersistenceContext,
  type Result,
  combine,
  err,
  isErr,
  ok,
} from "@repo/shared";
import { and, count, eq, ilike, isNull, or } from "drizzle-orm";
import type { DrizzleDB } from "../database/drizzle.client.ts";
import { fromPersistenceContext } from "../database/persistence-context.ts";
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
    return ctx ? fromPersistenceContext(ctx) : this.db;
  }

  private toInfrastructureError(error: unknown): AppError {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Database operation failed";
    return new AppError(message, "INFRASTRUCTURE_ERROR");
  }

  async findById(
    id: string,
    ctx?: PersistenceContext,
    options?: { includeDeleted?: boolean },
  ): Promise<Result<Optional<User>, AppError>> {
    try {
      // 1. Load all events for this aggregate from the Event Store
      const eventsResult = await this.eventStore.getEvents(id, ctx);
      if (eventsResult.isErr()) return err(eventsResult.error);

      const events = eventsResult.value;
      if (events.length === 0) return ok(undefined);

      // 2. Reconstitute the User aggregate from the event stream
      const userResult = User.fromEvents(events, new UniqueId(id));
      if (userResult.isErr()) {
        return err(
          new AppError(
            `Failed to reconstitute user from events: ${userResult.error.message}`,
            "INFRASTRUCTURE_ERROR",
          ),
        );
      }

      const user = userResult.value;

      // 3. Respect soft-delete (unless includeDeleted is true)
      if (user.isDeleted && !options?.includeDeleted) return ok(undefined);

      return ok(user);
    } catch (error) {
      return err(this.toInfrastructureError(error));
    }
  }

  async findByEmail(
    email: string,
    ctx?: PersistenceContext,
  ): Promise<Result<Optional<User>, AppError>> {
    const db = this.getDb(ctx);
    try {
      // 1. Lookup the ID in the projection table
      const record = await db.query.users.findFirst({
        where: and(eq(users.email, email), isNull(users.deletedAt)),
        columns: { id: true },
      });
      if (!record) return ok(undefined);

      // 2. Reconstitute from Event Store to ensure source-of-truth accuracy
      return this.findById(record.id, ctx);
    } catch (error) {
      return err(this.toInfrastructureError(error));
    }
  }

  async findAll(
    params?: {
      page?: number;
      limit?: number;
      search?: string;
    },
    ctx?: PersistenceContext,
  ): Promise<Result<{ users: User[]; total: number }, AppError>> {
    const db = this.getDb(ctx);
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 20;
    const offset = (page - 1) * limit;
    const search = params?.search;

    // Hybrid approach: findAll reads directly from the projection table (users)
    // rather than reconstituting each aggregate from the event store.
    // This is intentional for performance — replaying N event streams for a
    // paginated list would be prohibitively expensive.
    //
    // Consistency guarantee: the projection table is updated synchronously
    // within the same transaction as the event store append (in save()), so
    // there is no eventual-consistency window on a single node.
    //
    // If you need strict event-sourced reads for list queries, consider a
    // snapshot pattern or a periodically-rebuilt materialized view.

    try {
      const whereClause = search
        ? and(
            isNull(users.deletedAt),
            or(
              ilike(users.firstName, `%${search}%`),
              ilike(users.lastName, `%${search}%`),
              ilike(users.email, `%${search}%`),
            ),
          )
        : isNull(users.deletedAt);

      const [records, totalResult] = await Promise.all([
        db.query.users.findMany({
          where: whereClause,
          limit,
          offset,
          orderBy: (fields, { desc }) => [desc(fields.createdAt)],
        }),
        db.select({ value: count() }).from(users).where(whereClause),
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
    } catch (error) {
      return err(this.toInfrastructureError(error));
    }
  }

  async save(
    user: User,
    ctx?: PersistenceContext,
  ): Promise<Result<void, AppError>> {
    const db = this.getDb(ctx);
    try {
      // For Event Sourcing hybrid:
      // If version is 1, it's a new aggregate -> INSERT
      // If version > 1, it's an update -> UPDATE with optimistic locking
      if (user.version === 1) {
        await db.insert(users).values({
          id: user.id.value,
          firstName: user.name.firstName,
          lastName: user.name.lastName,
          email: user.email.value,
          role: user.role.toUpperCase() as "ADMIN" | "MEMBER" | "VIEWER",
          isActive: user.isActive,
          version: user.version,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          deletedAt: user.deletedAt,
        });
        return ok();
      }

      const result = await db
        .update(users)
        .set({
          firstName: user.name.firstName,
          lastName: user.name.lastName,
          email: user.email.value,
          role: user.role.toUpperCase() as "ADMIN" | "MEMBER" | "VIEWER",
          isActive: user.isActive,
          version: user.version,
          updatedAt: user.updatedAt,
          deletedAt: user.deletedAt,
        })
        .where(
          and(eq(users.id, user.id.value), eq(users.version, user.version - 1)),
        );

      if (result.rowCount === 0) {
        return err(
          new ConflictError(
            `Concurrency conflict: user "${user.id.value}" was modified by another process`,
          ),
        );
      }
      return ok();
    } catch (error) {
      return err(this.toInfrastructureError(error));
    }
  }

  async delete(
    id: string,
    ctx?: PersistenceContext,
  ): Promise<Result<void, AppError>> {
    try {
      const userResult = await this.findById(id, ctx, { includeDeleted: true });
      if (isErr(userResult)) return err(userResult.error);

      const user = userResult.value;
      if (!user) return err(new NotFoundError(`User "${id}" not found`));
      if (user.isDeleted)
        return err(new NotFoundError(`User "${id}" is already deleted`));

      user.delete();
      return this.save(user, ctx);
    } catch (error) {
      return err(this.toInfrastructureError(error));
    }
  }

  async existsByEmail(
    email: string,
    ctx?: PersistenceContext,
  ): Promise<Result<boolean, AppError>> {
    const db = this.getDb(ctx);
    try {
      const record = await db.query.users.findFirst({
        where: and(eq(users.email, email), isNull(users.deletedAt)),
        columns: { id: true },
      });
      return ok(record !== undefined);
    } catch (error) {
      return err(this.toInfrastructureError(error));
    }
  }

  private toDomain(record: typeof users.$inferSelect): Result<User, AppError> {
    const nameResult = UserName.create(record.firstName, record.lastName);
    const emailResult = Email.create(record.email);

    const result = combine([nameResult, emailResult]);
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
          deletedAt: record.deletedAt ?? undefined,
        },
        new UniqueId(record.id),
        record.version,
      ),
    );
  }
}
