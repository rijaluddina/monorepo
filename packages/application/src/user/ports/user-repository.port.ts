import type { User } from "@repo/domain";
import type { Optional } from "@repo/shared";

/**
 * IUserRepository — Port. Infrastructure implements with Drizzle+PostgreSQL.
 * Application layer depends on this interface, NOT the implementation.
 */
export interface IUserRepository {
  findById(id: string): Promise<Optional<User>>;
  findByEmail(email: string): Promise<Optional<User>>;
  findAll(params?: { page?: number; limit?: number }): Promise<{
    users: User[];
    total: number;
  }>;
  save(user: User): Promise<void>;
  update(user: User): Promise<void>;
  delete(id: string): Promise<void>;
  existsByEmail(email: string): Promise<boolean>;
}
