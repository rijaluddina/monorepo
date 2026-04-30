// CQRS shared interfaces
export type { Command } from "./shared/command.ts";
export type { CommandHandler } from "./shared/command-handler.ts";
export type { Query } from "./shared/query.ts";
export type { QueryHandler } from "./shared/query-handler.ts";
export type { ICommandBus } from "./shared/command-bus.port.ts";
export type { IQueryBus } from "./shared/query-bus.port.ts";
export type { IEventBus } from "./shared/event-bus.port.ts";

// User — ports
export type { IUserRepository } from "./user/ports/user-repository.port.ts";
export type { IUserEventStore } from "./user/ports/user-event-store.port.ts";

// User — DTOs
export type { UserDTO } from "./user/dto/user.dto.ts";

// User — commands
export { CreateUserCommand } from "./user/commands/create-user.command.ts";
export { CreateUserCommandHandler } from "./user/commands/create-user.handler.ts";

// User — queries
export { GetUsersQuery } from "./user/queries/get-users.query.ts";
export { GetUsersQueryHandler } from "./user/queries/get-users.handler.ts";
export { GetUserByIdQuery } from "./user/queries/get-user-by-id.query.ts";
export { GetUserByIdQueryHandler } from "./user/queries/get-user-by-id.handler.ts";

// User — mapper
export { mapUserToDTO } from "./user/user.mapper.ts";
