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

/**
 * Converts thrown errors into a uniform JSON envelope. Known {@link ApiError}s
 * keep their status and code; anything else becomes a 500.
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

  const message = err instanceof Error ? err.message : "unexpected error";
  res.status(500).json({
    error: { code: "INTERNAL", message },
  });
}
