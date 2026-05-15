import type { User } from "@repo/domain";
import type {
  AppError,
  Optional,
  PersistenceContext,
  Result,
} from "@repo/shared";

/**
 * IUserRepository — Port. Infrastructure implements with Drizzle+PostgreSQL.
 * Application layer depends on this interface, NOT the implementation.
 */
export interface IUserRepository {
  findById(
    id: string,
    ctx?: PersistenceContext,
  ): Promise<Result<Optional<User>, AppError>>;
  findByEmail(
    email: string,
    ctx?: PersistenceContext,
  ): Promise<Result<Optional<User>, AppError>>;
  findAll(
    params?: { page?: number; limit?: number },
    ctx?: PersistenceContext,
  ): Promise<
    Result<
      {
        users: User[];
        total: number;
      },
      AppError
    >
  >;
  save(user: User, ctx?: PersistenceContext): Promise<Result<void, AppError>>;
  delete(id: string, ctx?: PersistenceContext): Promise<Result<void, AppError>>;
  existsByEmail(
    email: string,
    ctx?: PersistenceContext,
  ): Promise<Result<boolean, AppError>>;
}
