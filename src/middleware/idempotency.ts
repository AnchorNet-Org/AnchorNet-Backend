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
 *
 * A SHA-256 fingerprint of the canonical JSON request body is stored alongside
 * the cached response. On key reuse, if the incoming body hash differs, a 422
 * `IDEMPOTENCY_KEY_REUSE` error is returned instead of replaying the cached
 * response. Canonical serialization uses stable key ordering so that
 * semantically identical bodies with different key orderings are treated as
 * the same request.
 */

import crypto from "crypto";
import { NextFunction, Request, Response } from "express";
import { ApiError } from "../errors/ApiError";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Default time a cached response remains eligible for replay. */
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Produce a deterministic JSON string for any value. Object keys are sorted
 * recursively so that `{ a: 1, b: 2 }` and `{ b: 2, a: 1 }` serialize to the
 * same string. Array element order is preserved (order is semantically
 * meaningful in arrays). Primitives and null pass through to JSON.stringify.
 */
function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return JSON.stringify(value);
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return "[" + value.map(stableStringify).join(",") + "]";
  }
  const sorted = Object.keys(value as Record<string, unknown>)
    .sort()
    .map(
      (k) =>
        JSON.stringify(k) +
        ":" +
        stableStringify((value as Record<string, unknown>)[k]),
    );
  return "{" + sorted.join(",") + "}";
}

/**
 * SHA-256 hex digest of the canonicalized request body. `undefined` (no body)
 * hashes the empty string; an explicit `{}` hashes `"{}"`. This distinction
 * is deliberate: the two are different wire representations.
 */
function hashBody(body: unknown): string {
  const raw = body !== undefined ? stableStringify(body) : "";
  return crypto.createHash("sha256").update(raw).digest("hex");
}

interface CachedResponse {
  status: number;
  body: unknown;
  expiresAt: number;
  bodyHash: string;
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
      // NOTE: concurrent requests with the same key may both pass this check
      // before either writes to the cache (check-then-set race). This is a
      // pre-existing limitation of the in-memory Map design, not introduced
      // by this change. See README for per-process scope.
      if (cached.bodyHash !== hashBody(req.body)) {
        next(
          ApiError.idempotencyKeyReuse(
            "Idempotency key already used with a different request body",
          ),
        );
        return;
      }
      res.status(cached.status).json(cached.body);
      return;
    }

    const originalJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      cache.set(cacheKey, {
        status: res.statusCode,
        body,
        expiresAt: now + ttlMs,
        bodyHash: hashBody(req.body),
      });
      return originalJson(body);
    }) as Response["json"];

    next();
  };
}
