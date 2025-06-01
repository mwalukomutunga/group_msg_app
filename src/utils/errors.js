/**
 * Custom Error Classes
 * Standardized error handling for the application
 */

/**
 * Base custom error class
 */
class AppError extends Error {
  constructor(message, statusCode, errorCode) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validation error for input validation failures
 */
class ValidationError extends AppError {
  constructor(message, errors = []) {
    super(message, 400, 'VALIDATION_ERROR');
    this.errors = errors;
  }
}

/**
 * Authentication error for auth failures
 */
class AuthenticationError extends AppError {
  constructor(message, errorCode = 'AUTHENTICATION_ERROR') {
    super(message, 401, errorCode);
  }
}

/**
 * Authorization error for permission issues
 */
class AuthorizationError extends AppError {
  constructor(message, errorCode = 'AUTHORIZATION_ERROR') {
    super(message, 403, errorCode);
  }
}

/**
 * Conflict error for duplicate resources
 */
class ConflictError extends AppError {
  constructor(message, errorCode = 'CONFLICT_ERROR', field = null) {
    super(message, 409, errorCode);
    this.field = field;
  }
}

/**
 * Not found error for missing resources
 */
class NotFoundError extends AppError {
  constructor(message, errorCode = 'NOT_FOUND') {
    super(message, 404, errorCode);
  }
}

/**
 * Rate limit error
 */
class RateLimitError extends AppError {
  constructor(message, retryAfter = '15 minutes') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
    this.retryAfter = retryAfter;
  }
}

/**
 * Bad request error
 */
class BadRequestError extends AppError {
  constructor(message, errorCode = 'BAD_REQUEST') {
    super(message, 400, errorCode);
  }
}

/**
 * Internal server error
 */
class InternalError extends AppError {
  constructor(message = 'Internal server error') {
    super(message, 500, 'INTERNAL_SERVER_ERROR');
  }
}

module.exports = {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  NotFoundError,
  RateLimitError,
  BadRequestError,
  InternalError,
};
