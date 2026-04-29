/**
 * AppError — Base error class for all application errors.
 * Enables categorized, structured errors with HTTP status codes.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    code: string,
    statusCode = 500,
    isOperational = true,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    (
      Error as unknown as {
        captureStackTrace?: (t: unknown, c: unknown) => void;
      }
    ).captureStackTrace?.(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    const msg = id
      ? `${resource} with id "${id}" not found`
      : `${resource} not found`;
    super(msg, "NOT_FOUND", 404);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, "VALIDATION_ERROR", 400);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, "CONFLICT", 409);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, "UNAUTHORIZED", 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(message, "FORBIDDEN", 403);
  }
}
