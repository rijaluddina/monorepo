import { NotFoundError, err, isErr, ok } from "@repo/shared";
import type { Result } from "@repo/shared";
import type { QueryHandler } from "../../shared/query-handler.js";
import type { UserDTO } from "../dto/user.dto.js";
import type { IUserRepository } from "../ports/user-repository.port.js";
import { mapUserToDTO } from "../user.mapper.js";
import type { GetUserByIdQuery } from "./get-user-by-id.query.js";

export class GetUserByIdQueryHandler
  implements QueryHandler<GetUserByIdQuery, UserDTO>
{
  constructor(private readonly userRepository: IUserRepository) {}

  async handle(query: GetUserByIdQuery): Promise<Result<UserDTO>> {
    const result = await this.userRepository.findById(query.id);

    if (isErr(result)) {
      return err(result.error);
    }

    const user = result.value;
    if (!user) {
      return err(new NotFoundError("User", query.id));
    }
    return ok(mapUserToDTO(user));
  }
}
