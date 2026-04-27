import type { Query } from "../../shared/query.js";

export class GetUsersQuery implements Query {
  public readonly _type = "Query" as const;

  constructor(
    public readonly page: number = 1,
    public readonly limit: number = 20,
  ) {}
}
