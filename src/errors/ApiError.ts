/**
 * Typed HTTP error used across the API.
 *
 * Carries an HTTP status code and a stable machine-readable `code` so that
 * the error-handling middleware can produce consistent JSON responses.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }

  static badRequest(message: string, code = "BAD_REQUEST"): ApiError {
    return new ApiError(400, code, message);
  }

  static unauthorized(message: string, code = "UNAUTHORIZED"): ApiError {
    return new ApiError(401, code, message);
  }

  static notFound(message: string, code = "NOT_FOUND"): ApiError {
    return new ApiError(404, code, message);
  }

  static conflict(message: string, code = "CONFLICT"): ApiError {
    return new ApiError(409, code, message);
  }

  static tooManyRequests(message: string, code = "RATE_LIMITED"): ApiError {
    return new ApiError(429, code, message);
  }
}
