import { err, isErr, ok } from "@repo/shared";
import type { PaginatedResult, Result } from "@repo/shared";
import type { UserDTO } from "@repo/shared";
import type { QueryHandler } from "../../shared/query-handler.ts";
import type { IUserRepository } from "../ports/user-repository.port.ts";
import { mapUserToDTO } from "../user.mapper.ts";
import type { GetUsersQuery } from "./get-users.query.ts";

/**
 * GetUsersQueryHandler — Paginated user list.
 *
 * Intentionally NOT cached on the server side because:
 *   - List queries read from the projection table directly (fast DB query)
 *   - Cache invalidation for paginated lists with search is complex
 *     (wildcard key deletion across many combinations)
 *   - The FE handles its own caching via TanStack React Query with
 *     automatic invalidation after every mutation
 *
 * Single-user queries (GetUserByIdQueryHandler) ARE cached because
 * findById() requires expensive event store reconstitution.
 */
export class GetUsersQueryHandler
  implements QueryHandler<GetUsersQuery, PaginatedResult<UserDTO>>
{
  constructor(private readonly userRepository: IUserRepository) {}

  async handle(
    query: GetUsersQuery,
  ): Promise<Result<PaginatedResult<UserDTO>>> {
    const result = await this.userRepository.findAll({
      page: query.page,
      limit: query.limit,
      search: query.search,
    });

    if (isErr(result)) {
      return err(result.error);
    }

    const { users, total } = result.value;

    const paginatedResult: PaginatedResult<UserDTO> = {
      data: users.map(mapUserToDTO),
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };

    return ok(paginatedResult);
  }
}
