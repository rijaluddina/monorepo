import { type Mock, beforeEach, describe, expect, mock, test } from "bun:test";
import { ConflictError, ValidationError, err, ok } from "@repo/shared";
import type { IEventBus } from "../../shared/event-bus.port.ts";
import type { IEventStore } from "../../shared/event-store.port.ts";
import type { IOutboxPort } from "../../shared/ports/outbox.port.ts";
import type { IUnitOfWork } from "../../shared/unit-of-work.port.ts";
import type { IUserRepository } from "../ports/user-repository.port.ts";
import { CreateUserCommand } from "./create-user.command.ts";
import { CreateUserCommandHandler } from "./create-user.handler.ts";

describe("CreateUserCommandHandler", () => {
  let userRepository: IUserRepository;
  let eventStore: IEventStore;
  let eventBus: IEventBus;
  let outboxPort: IOutboxPort;
  let unitOfWork: IUnitOfWork;
  let handler: CreateUserCommandHandler;

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
    } as unknown as IEventBus;

    outboxPort = {
      insert: mock(),
    } as unknown as IOutboxPort;

    unitOfWork = {
      run: mock((work) => work({})),
    } as unknown as IUnitOfWork;

    handler = new CreateUserCommandHandler(
      userRepository,
      eventStore,
      eventBus,
      outboxPort,
      unitOfWork,
    );
  });

  test("should create a user successfully", async () => {
    // Arrange
    const command = new CreateUserCommand(
      "John",
      "Doe",
      "john.doe@example.com",
      "member",
    );

    (
      userRepository.existsByEmail as Mock<typeof userRepository.existsByEmail>
    ).mockResolvedValue(ok(false));
    (userRepository.save as Mock<typeof userRepository.save>).mockResolvedValue(
      ok(undefined),
    );
    (eventStore.append as Mock<typeof eventStore.append>).mockResolvedValue(
      ok(undefined),
    );
    (outboxPort.insert as Mock<typeof outboxPort.insert>).mockResolvedValue(
      ok(undefined),
    );
    (eventBus.publishAll as Mock<typeof eventBus.publishAll>).mockResolvedValue(
      ok(undefined),
    );

    // Act
    const result = await handler.handle(command);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.email).toBe(command.email);
      expect(result.value.firstName).toBe(command.firstName);
    }

    expect(userRepository.existsByEmail).toHaveBeenCalledWith(command.email);
    expect(userRepository.save).not.toHaveBeenCalled();
    expect(eventStore.append).toHaveBeenCalled();
    expect(outboxPort.insert).toHaveBeenCalled();
  });

  test("should fail if email already exists", async () => {
    // Arrange
    const command = new CreateUserCommand(
      "John",
      "Doe",
      "john.doe@example.com",
    );

    (
      userRepository.existsByEmail as Mock<typeof userRepository.existsByEmail>
    ).mockResolvedValue(ok(true));

    // Act
    const result = await handler.handle(command);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ConflictError);
    }
    expect(userRepository.save).not.toHaveBeenCalled();
  });

  test("should fail if validation fails", async () => {
    // Arrange
    const command = new CreateUserCommand("", "Doe", "invalid-email");

    (
      userRepository.existsByEmail as Mock<typeof userRepository.existsByEmail>
    ).mockResolvedValue(ok(false));

    // Act
    const result = await handler.handle(command);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
    expect(userRepository.save).not.toHaveBeenCalled();
  });
});
