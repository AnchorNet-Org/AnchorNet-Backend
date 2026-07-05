/**
 * In-memory rate limiter for mutating requests.
 *
 * Tracks request counts per client (by IP) in a fixed rolling window and
 * rejects requests over the limit with 429. Read-only requests are always
 * allowed. State lives in a plain `Map` local to the returned middleware, so
 * each `rateLimiter()` instance keeps its own counters; this is a per-process
 * safeguard and not suitable for multi-instance deployments without a shared
 * store.
 */

import { NextFunction, Request, Response } from "express";
import { ApiError } from "../errors/ApiError";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Default number of mutating requests allowed per client per window. */
const DEFAULT_MAX = 30;
/** Default rolling window length, in milliseconds. */
const DEFAULT_WINDOW_MS = 60_000;

interface Bucket {
  count: number;
  resetAt: number;
}

export interface RateLimitOptions {
  /** Maximum mutating requests allowed per client within the window. */
  max?: number;
  /** Length of the rolling window, in milliseconds. */
  windowMs?: number;
}

export function rateLimiter(options: RateLimitOptions = {}) {
  const max = options.max ?? DEFAULT_MAX;
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const buckets = new Map<string, Bucket>();

  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!MUTATING_METHODS.has(req.method)) {
      next();
      return;
    }

    const key = req.ip ?? "unknown";
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (bucket.count >= max) {
      next(ApiError.tooManyRequests("rate limit exceeded, try again later"));
      return;
    }

    bucket.count += 1;
    next();
  };
}
