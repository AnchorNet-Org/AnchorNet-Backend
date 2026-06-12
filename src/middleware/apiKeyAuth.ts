/**
 * API-key authentication for mutating requests.
 *
 * When an API key is configured, requests using a mutating method must present
 * a matching `x-api-key` header. Read-only requests are always allowed, and if
 * no key is configured the middleware is a no-op (open access).
 */

import { NextFunction, Request, Response } from "express";
import { ApiError } from "../errors/ApiError";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function apiKeyAuth(apiKey?: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!apiKey || !MUTATING_METHODS.has(req.method)) {
      next();
      return;
    }

    if (req.header("x-api-key") !== apiKey) {
      next(ApiError.unauthorized("missing or invalid API key"));
      return;
    }

    next();
  };
}
