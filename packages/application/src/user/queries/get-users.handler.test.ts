import { describe, expect, it, mock } from "bun:test";
import { Email, UniqueId, User, UserName } from "@repo/domain";
import { ok } from "@repo/shared";
import { GetUsersQueryHandler } from "./get-users.handler.ts";
import { GetUsersQuery } from "./get-users.query.ts";

describe("GetUsersQueryHandler", () => {
  const mockUserRepository = {
    findAll: mock(),
  };

  // biome-ignore lint/suspicious/noExplicitAny: mock repository for test
  const handler = new GetUsersQueryHandler(mockUserRepository as any);

  it("should return paginated users", async () => {
    const user = User.reconstitute(
      {
        name: UserName.create("John", "Doe").unwrap(),
        email: Email.create("john@example.com").unwrap(),
        role: "member",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      new UniqueId(),
      1,
    );

    mockUserRepository.findAll.mockResolvedValue(
      ok({
        users: [user],
        total: 1,
      }),
    );

    const query = new GetUsersQuery(1, 10);
    const result = await handler.handle(query);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.data).toHaveLength(1);
      expect(result.value.total).toBe(1);
      expect(result.value.page).toBe(1);
      expect(result.value.totalPages).toBe(1);
    }
  });
});
