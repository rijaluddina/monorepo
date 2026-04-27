// CQRS shared interfaces
export type { Command } from "./shared/command.js";
export type { CommandHandler } from "./shared/command-handler.js";
export type { Query } from "./shared/query.js";
export type { QueryHandler } from "./shared/query-handler.js";
export type { ICommandBus } from "./shared/command-bus.port.js";
export type { IQueryBus } from "./shared/query-bus.port.js";
export type { IEventBus } from "./shared/event-bus.port.js";

// User — ports
export type { IUserRepository } from "./user/ports/user-repository.port.js";
export type { IUserEventStore } from "./user/ports/user-event-store.port.js";

// User — DTOs
export type { UserDTO } from "./user/dto/user.dto.js";

// User — commands
export { CreateUserCommand } from "./user/commands/create-user.command.js";
export { CreateUserCommandHandler } from "./user/commands/create-user.handler.js";

// User — queries
export { GetUsersQuery } from "./user/queries/get-users.query.js";
export { GetUsersQueryHandler } from "./user/queries/get-users.handler.js";
export { GetUserByIdQuery } from "./user/queries/get-user-by-id.query.js";
export { GetUserByIdQueryHandler } from "./user/queries/get-user-by-id.handler.js";

// User — mapper
export { mapUserToDTO } from "./user/user.mapper.js";
