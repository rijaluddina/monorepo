import type { User } from "@repo/domain";
import type { AppError, Optional, Result } from "@repo/shared";

/**
 * IUserRepository — Port. Infrastructure implements with Drizzle+PostgreSQL.
 * Application layer depends on this interface, NOT the implementation.
 */
export interface IUserRepository {
  findById(id: string): Promise<Result<Optional<User>, AppError>>;
  findByEmail(email: string): Promise<Result<Optional<User>, AppError>>;
  findAll(params?: { page?: number; limit?: number }): Promise<
    Result<
      {
        users: User[];
        total: number;
      },
      AppError
    >
  >;
  save(user: User): Promise<Result<void, AppError>>;
  update(user: User): Promise<Result<void, AppError>>;
  delete(id: string): Promise<Result<void, AppError>>;
  existsByEmail(email: string): Promise<Result<boolean, AppError>>;
}
