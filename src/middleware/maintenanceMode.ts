/**
 * Maintenance-mode middleware.
 *
 * When enabled, rejects mutating requests with 503 while leaving read-only
 * requests (and health checks) working, so operators can put the write path
 * on hold without taking the whole API down.
 */

import { NextFunction, Request, Response } from "express";
import { ApiError } from "../errors/ApiError";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function maintenanceMode(enabled: boolean) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!enabled || !MUTATING_METHODS.has(req.method)) {
      next();
      return;
    }

    next(
      ApiError.serviceUnavailable(
        "the API is in maintenance mode; mutating requests are temporarily disabled",
      ),
    );
  };
}
