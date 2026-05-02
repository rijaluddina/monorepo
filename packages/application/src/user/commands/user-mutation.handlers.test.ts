import { type Mock, beforeEach, describe, expect, mock, test } from "bun:test";
import {
  USER_DELETED,
  User,
  UserActivatedEvent,
  UserDeletedEvent,
  UserEmailChangedEvent,
  UserRoleChangedEvent,
} from "@repo/domain";
import { AppError, ConflictError, NotFoundError, err, ok } from "@repo/shared";
import type { IEventBus } from "../../shared/event-bus.port.ts";
import type { IEventStore } from "../../shared/event-store.port.ts";
import type { IUnitOfWork } from "../../shared/unit-of-work.port.ts";
import type { IUserRepository } from "../ports/user-repository.port.ts";
import { ActivateUserCommand } from "./activate-user.command.ts";
import { ActivateUserCommandHandler } from "./activate-user.handler.ts";
import { ChangeUserEmailCommand } from "./change-user-email.command.ts";
import { ChangeUserEmailCommandHandler } from "./change-user-email.handler.ts";
import { ChangeUserRoleCommand } from "./change-user-role.command.ts";
import { ChangeUserRoleCommandHandler } from "./change-user-role.handler.ts";
import { DeleteUserCommand } from "./delete-user.command.ts";
import { DeleteUserCommandHandler } from "./delete-user.handler.ts";

function createUser(
  overrides: Partial<Parameters<typeof User.create>[0]> = {},
) {
  const result = User.create({
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
    role: "member",
    ...overrides,
  });

  if (result.isErr()) throw result.error;
  result.value.clearEvents();
  return result.value;
}

describe("User mutation command handlers", () => {
  let userRepository: IUserRepository;
  let eventStore: IEventStore;
  let eventBus: IEventBus;
  let unitOfWork: IUnitOfWork;
  const txContext = { tx: true };

  beforeEach(() => {
    userRepository = {
      existsByEmail: mock(),
      save: mock(),
      findById: mock(),
      findByEmail: mock(),
      findAll: mock(),
      update: mock(),
      delete: mock(),
    } as unknown as IUserRepository;

    eventStore = {
      append: mock(),
      getEvents: mock(),
      getEventsByType: mock(),
    } as unknown as IEventStore;

    eventBus = {
      publish: mock(),
      publishAll: mock(),
      subscribe: mock(),
    } as unknown as IEventBus;

    unitOfWork = {
      run: mock((work) => work(txContext)),
    } as unknown as IUnitOfWork;

    (
      userRepository.update as Mock<typeof userRepository.update>
    ).mockResolvedValue(ok(undefined));
    (
      userRepository.delete as Mock<typeof userRepository.delete>
    ).mockResolvedValue(ok(undefined));
    (eventStore.append as Mock<typeof eventStore.append>).mockResolvedValue(
      ok(undefined),
    );
    (eventBus.publishAll as Mock<typeof eventBus.publishAll>).mockResolvedValue(
      ok(undefined),
    );
  });

  test("activate should update, append, publish, and clear emitted events", async () => {
    const user = createUser();
    user.deactivate();
    user.clearEvents();
    (
      userRepository.findById as Mock<typeof userRepository.findById>
    ).mockResolvedValue(ok(user));
    const handler = new ActivateUserCommandHandler(
      userRepository,
      eventStore,
      eventBus,
      unitOfWork,
    );

    const result = await handler.handle(new ActivateUserCommand(user.id.value));

    expect(result.isOk()).toBe(true);
    expect(userRepository.update).toHaveBeenCalledWith(user, txContext);
    expect(eventStore.append).toHaveBeenCalledWith(
      user.id.value,
      [expect.any(UserActivatedEvent)],
      txContext,
    );
    expect(eventBus.publishAll).toHaveBeenCalledWith([
      expect.any(UserActivatedEvent),
    ]);
    expect(user.domainEvents).toEqual([]);
  });

  test("change email should reject duplicate email before mutating", async () => {
    const user = createUser();
    (
      userRepository.findById as Mock<typeof userRepository.findById>
    ).mockResolvedValue(ok(user));
    (
      userRepository.existsByEmail as Mock<typeof userRepository.existsByEmail>
    ).mockResolvedValue(ok(true));
    const handler = new ChangeUserEmailCommandHandler(
      userRepository,
      eventStore,
      eventBus,
      unitOfWork,
    );

    const result = await handler.handle(
      new ChangeUserEmailCommand(user.id.value, "taken@example.com"),
    );

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error).toBeInstanceOf(ConflictError);
    expect(userRepository.update).not.toHaveBeenCalled();
    expect(eventStore.append).not.toHaveBeenCalled();
    expect(user.email.value).toBe("ada@example.com");
  });

  test("change email should update and append the email changed event", async () => {
    const user = createUser();
    (
      userRepository.findById as Mock<typeof userRepository.findById>
    ).mockResolvedValue(ok(user));
    (
      userRepository.existsByEmail as Mock<typeof userRepository.existsByEmail>
    ).mockResolvedValue(ok(false));
    const handler = new ChangeUserEmailCommandHandler(
      userRepository,
      eventStore,
      eventBus,
      unitOfWork,
    );

    const result = await handler.handle(
      new ChangeUserEmailCommand(user.id.value, "new@example.com"),
    );

    expect(result.isOk()).toBe(true);
    expect(userRepository.update).toHaveBeenCalledWith(user, txContext);
    expect(eventStore.append).toHaveBeenCalledWith(
      user.id.value,
      [expect.any(UserEmailChangedEvent)],
      txContext,
    );
    expect(user.email.value).toBe("new@example.com");
    expect(user.domainEvents).toEqual([]);
  });

  test("change role should update and append the role changed event", async () => {
    const user = createUser();
    (
      userRepository.findById as Mock<typeof userRepository.findById>
    ).mockResolvedValue(ok(user));
    const handler = new ChangeUserRoleCommandHandler(
      userRepository,
      eventStore,
      eventBus,
      unitOfWork,
    );

    const result = await handler.handle(
      new ChangeUserRoleCommand(user.id.value, "admin"),
    );

    expect(result.isOk()).toBe(true);
    expect(userRepository.update).toHaveBeenCalledWith(user, txContext);
    expect(eventStore.append).toHaveBeenCalledWith(
      user.id.value,
      [expect.any(UserRoleChangedEvent)],
      txContext,
    );
    expect(user.role).toBe("admin");
    expect(user.domainEvents).toEqual([]);
  });

  test("mutation handlers should return not found when user is missing", async () => {
    (
      userRepository.findById as Mock<typeof userRepository.findById>
    ).mockResolvedValue(ok(undefined));
    const handler = new ActivateUserCommandHandler(
      userRepository,
      eventStore,
      eventBus,
      unitOfWork,
    );

    const result = await handler.handle(new ActivateUserCommand("missing-id"));

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error).toBeInstanceOf(NotFoundError);
    expect(unitOfWork.run).not.toHaveBeenCalled();
  });

  test("mutation handlers should stop when append fails", async () => {
    const user = createUser();
    user.deactivate();
    user.clearEvents();
    (
      userRepository.findById as Mock<typeof userRepository.findById>
    ).mockResolvedValue(ok(user));
    (eventStore.append as Mock<typeof eventStore.append>).mockResolvedValue(
      err(new AppError("append failed", "APPEND_FAILED")),
    );
    const handler = new ActivateUserCommandHandler(
      userRepository,
      eventStore,
      eventBus,
      unitOfWork,
    );

    const result = await handler.handle(new ActivateUserCommand(user.id.value));

    expect(result.isErr()).toBe(true);
    expect(eventBus.publishAll).not.toHaveBeenCalled();
    expect(user.domainEvents).toHaveLength(1);
  });

  test("delete should append and publish UserDeletedEvent before hard delete", async () => {
    const user = createUser();
    (
      userRepository.findById as Mock<typeof userRepository.findById>
    ).mockResolvedValue(ok(user));
    const handler = new DeleteUserCommandHandler(
      userRepository,
      eventStore,
      eventBus,
      unitOfWork,
    );

    const result = await handler.handle(new DeleteUserCommand(user.id.value));

    expect(result.isOk()).toBe(true);
    expect(eventStore.append).toHaveBeenCalledWith(
      user.id.value,
      [expect.any(UserDeletedEvent)],
      txContext,
    );
    expect(userRepository.delete).toHaveBeenCalledWith(
      user.id.value,
      txContext,
    );
    expect(eventBus.publishAll).toHaveBeenCalledWith([
      expect.objectContaining({ eventType: USER_DELETED }),
    ]);
    expect(user.domainEvents).toEqual([]);
  });
});
