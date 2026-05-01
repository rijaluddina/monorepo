// CQRS shared interfaces
export type { Command } from "./shared/command.ts";
export type { CommandHandler } from "./shared/command-handler.ts";
export type { Query } from "./shared/query.ts";
export type { QueryHandler } from "./shared/query-handler.ts";
export type { ICommandBus } from "./shared/command-bus.port.ts";
export type { IQueryBus } from "./shared/query-bus.port.ts";
export type { IEventBus } from "./shared/event-bus.port.ts";
export type { IEventStore } from "./shared/event-store.port.ts";
export type { IUnitOfWork } from "./shared/unit-of-work.port.ts";

// User — ports
export type { IUserRepository } from "./user/ports/user-repository.port.ts";

// User — DTOs
export type { UserDTO } from "./user/dto/user.dto.ts";

// User — commands
export { CreateUserCommand } from "./user/commands/create-user.command.ts";
export { CreateUserCommandHandler } from "./user/commands/create-user.handler.ts";
export { ActivateUserCommand } from "./user/commands/activate-user.command.ts";
export { ActivateUserCommandHandler } from "./user/commands/activate-user.handler.ts";
export { DeactivateUserCommand } from "./user/commands/deactivate-user.command.ts";
export { DeactivateUserCommandHandler } from "./user/commands/deactivate-user.handler.ts";
export { ChangeUserEmailCommand } from "./user/commands/change-user-email.command.ts";
export { ChangeUserEmailCommandHandler } from "./user/commands/change-user-email.handler.ts";
export { ChangeUserRoleCommand } from "./user/commands/change-user-role.command.ts";
export { ChangeUserRoleCommandHandler } from "./user/commands/change-user-role.handler.ts";
export { DeleteUserCommand } from "./user/commands/delete-user.command.ts";
export { DeleteUserCommandHandler } from "./user/commands/delete-user.handler.ts";

// User — queries
export { GetUsersQuery } from "./user/queries/get-users.query.ts";
export { GetUsersQueryHandler } from "./user/queries/get-users.handler.ts";
export { GetUserByIdQuery } from "./user/queries/get-user-by-id.query.ts";
export { GetUserByIdQueryHandler } from "./user/queries/get-user-by-id.handler.ts";

// User — mapper
export { mapUserToDTO } from "./user/user.mapper.ts";
