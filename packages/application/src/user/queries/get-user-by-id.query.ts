import type { Query } from "../../shared/query.ts";

export class GetUserByIdQuery implements Query {
  public readonly _type = "Query" as const;

  constructor(public readonly id: string) {}
}
