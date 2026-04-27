import { User, UniqueId, Email, UserName } from "@repo/domain";
import type { IUserRepository } from "@repo/application";
import type { Optional } from "@repo/shared";
import type { PrismaClient } from "../database/prisma.client.js";

type PrismaUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * PrismaUserRepository — implements IUserRepository via Prisma + PostgreSQL.
 *
 * Bridges domain aggregate ↔ Prisma ORM model.
 * Reconstitutes domain aggregate from DB records.
 */
export class PrismaUserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Optional<User>> {
    const record = await this.prisma.user.findUnique({ where: { id } });
    if (!record) return undefined;
    return this.toDomain(record);
  }

  async findByEmail(email: string): Promise<Optional<User>> {
    const record = await this.prisma.user.findUnique({ where: { email } });
    if (!record) return undefined;
    return this.toDomain(record);
  }

  async findAll(params?: {
    page?: number;
    limit?: number;
  }): Promise<{ users: User[]; total: number }> {
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 20;
    const skip = (page - 1) * limit;

    const [records, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.user.count(),
    ]);

    return {
      users: records.map((r) => this.toDomain(r)),
      total,
    };
  }

  async save(user: User): Promise<void> {
    await this.prisma.user.create({
      data: {
        id: user.id.value,
        firstName: user.name.firstName,
        lastName: user.name.lastName,
        email: user.email.value,
        role: user.role.toUpperCase() as "ADMIN" | "MEMBER" | "VIEWER",
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  }

  async update(user: User): Promise<void> {
    await this.prisma.user.update({
      where: { id: user.id.value },
      data: {
        firstName: user.name.firstName,
        lastName: user.name.lastName,
        email: user.email.value,
        role: user.role.toUpperCase() as "ADMIN" | "MEMBER" | "VIEWER",
        isActive: user.isActive,
        updatedAt: user.updatedAt,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.user.delete({ where: { id } });
  }

  async existsByEmail(email: string): Promise<boolean> {
    const count = await this.prisma.user.count({ where: { email } });
    return count > 0;
  }

  /** Map Prisma record → domain User aggregate (reconstitute) */
  private toDomain(record: PrismaUser): User {
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
