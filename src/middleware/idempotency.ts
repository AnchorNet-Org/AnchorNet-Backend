/**
 * Idempotency-key support for mutating requests.
 *
 * Clients may send an `Idempotency-Key` header on POST/PUT/PATCH/DELETE
 * requests. The first request for a given key/method/path combination runs
 * normally and its JSON response is cached; any later request reusing the
 * same key within the TTL replays the cached response instead of re-running
 * the handler, so retrying a request that already took effect (or already
 * failed) doesn't double-apply side effects. Requests without the header are
 * unaffected. State lives in a plain `Map` local to the returned middleware,
 * so like the existing rate limiter this is a per-process safeguard and not
 * suitable for multi-instance deployments without a shared store.
 */

import { NextFunction, Request, Response } from "express";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Default time a cached response remains eligible for replay. */
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

interface CachedResponse {
  status: number;
  body: unknown;
  expiresAt: number;
}

export interface IdempotencyOptions {
  /** Milliseconds a cached response remains eligible for replay. */
  ttlMs?: number;
}

export function idempotency(options: IdempotencyOptions = {}) {
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const cache = new Map<string, CachedResponse>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.header("idempotency-key");
    if (!key || !MUTATING_METHODS.has(req.method)) {
      next();
      return;
    }

    const cacheKey = `${req.method} ${req.originalUrl} ${key}`;
    const now = Date.now();
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      res.status(cached.status).json(cached.body);
      return;
    }

    const originalJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      cache.set(cacheKey, {
        status: res.statusCode,
        body,
        expiresAt: now + ttlMs,
      });
      return originalJson(body);
    }) as Response["json"];

    next();
  };
}
