import { NotFoundError, err, isErr, ok } from "@repo/shared";
import type { Result } from "@repo/shared";
import type { UserDTO } from "@repo/shared";
import type { ICache } from "../../shared/cache.port.ts";
import type { QueryHandler } from "../../shared/query-handler.ts";
import type { IUserRepository } from "../ports/user-repository.port.ts";
import { mapUserToDTO } from "../user.mapper.ts";
import type { GetUserByIdQuery } from "./get-user-by-id.query.ts";

const CACHE_TTL_SECONDS = 60;
const CACHE_KEY_PREFIX = "user";

export class GetUserByIdQueryHandler
  implements QueryHandler<GetUserByIdQuery, UserDTO>
{
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly cache: ICache,
  ) {}

  async handle(query: GetUserByIdQuery): Promise<Result<UserDTO>> {
    const cacheKey = `${CACHE_KEY_PREFIX}:${query.id}`;

    // Try cache first
    const cached = await this.cache.get<UserDTO>(cacheKey);
    if (cached) return ok(cached);

    // Fall through to DB
    const result = await this.userRepository.findById(query.id);

    if (isErr(result)) {
      return err(result.error);
    }

    const user = result.value;
    if (!user) {
      return err(new NotFoundError("User", query.id));
    }

    const dto = mapUserToDTO(user);

    // Populate cache (best-effort, non-critical)
    await this.cache.set(cacheKey, dto, CACHE_TTL_SECONDS);

    return ok(dto);
  }
}
