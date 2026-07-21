/**
 * Express middleware for consistent error and 404 responses.
 */

import { NextFunction, Request, Response } from "express";
import { ApiError } from "../errors/ApiError";

/** Terminal handler for unmatched routes. */
export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    error: { code: "NOT_FOUND", message: "resource not found" },
  });
}

/** Stable error codes for known 4xx statuses raised outside of {@link ApiError}. */
const CLIENT_ERROR_CODES: Record<number, string> = {
  400: "BAD_REQUEST",
  413: "PAYLOAD_TOO_LARGE",
};

/**
 * Extracts a numeric HTTP status from an error shaped like the `http-errors`
 * instances thrown by `body-parser` (e.g. malformed JSON or an oversized
 * request body), which expose `status`/`statusCode` but aren't {@link ApiError}s.
 */
function clientErrorStatus(err: unknown): number | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const status = (err as { status?: unknown; statusCode?: unknown }).status ??
    (err as { statusCode?: unknown }).statusCode;
  return typeof status === "number" && status >= 400 && status < 500
    ? status
    : undefined;
}

/**
 * Converts thrown errors into a uniform JSON envelope. Known {@link ApiError}s
 * keep their status and code. Body-parser style 4xx errors (malformed JSON,
 * oversized payloads) are mapped to the same envelope with a stable code.
 * Anything else becomes a 500.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ApiError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message },
    });
    return;
  }

  const status = clientErrorStatus(err);
  if (status !== undefined) {
    const message = err instanceof Error ? err.message : "invalid request";
    res.status(status).json({
      error: { code: CLIENT_ERROR_CODES[status] ?? "BAD_REQUEST", message },
    });
    return;
  }

  res.locals.error = err;
  const isProduction = process.env.NODE_ENV === "production";
  const message = (err instanceof Error && !isProduction) ? err.message : "unexpected error";
  res.status(500).json({
    error: { code: "INTERNAL", message },
  });
}
