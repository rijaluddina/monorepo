import { ok, isErr, err } from "@repo/shared";
import type { PaginatedResult, Result } from "@repo/shared";
import type { QueryHandler } from "../../shared/query-handler.js";
import type { UserDTO } from "../dto/user.dto.js";
import type { IUserRepository } from "../ports/user-repository.port.js";
import { mapUserToDTO } from "../user.mapper.js";
import type { GetUsersQuery } from "./get-users.query.js";

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
