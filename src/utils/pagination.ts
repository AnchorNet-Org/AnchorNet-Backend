/**
 * Offset-based pagination helper for in-memory collections.
 */

import { ApiError } from "../errors/ApiError";

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/**
 * Parses a query-string integer param, distinguishing three states:
 *   - `undefined`  → use `fallback` (param omitted; legacy behavior)
 *   - `""`         → use `fallback` (empty is treated as omitted; see below)
 *   - anything else → must match /^\d+$/ and be ≥ 1, or throws
 *     {@link ApiError.badRequest}.
 *
 * Empty-as-omitted: `?page=` is arguably a client bug too, but browsers and
 * form libraries routinely serialize unset fields as empty strings. Treating
 * empty as omitted keeps benign traffic working while still rejecting the
 * garbage cases the issue #108 acceptance criteria call out (`abc`, `1.5`,
 * `-1`). The choice is documented and tested; flip the branch below if the
 * team prefers strict rejection.
 */
function parseIntegerParam(
  raw: unknown,
  name: "page" | "pageSize",
  fallback: number,
): number {
  if (raw === undefined || raw === "") return fallback;

  // Reject arrays (?page=1&page=2 in Express) and objects up front.
  if (typeof raw !== "string" && typeof raw !== "number") {
    throw ApiError.badRequest(`"${name}" must be a positive integer`);
  }

  const asString = typeof raw === "string" ? raw : String(raw);

  // Strict integer: no leading +, no decimals, no exponent, no whitespace.
  // Rejects "1.5", "abc", "-1", "1e3", " 1 ".
  if (!/^\d+$/.test(asString)) {
    throw ApiError.badRequest(`"${name}" must be a positive integer`);
  }

  const parsed = Number.parseInt(asString, 10);
  if (parsed < 1) {
    throw ApiError.badRequest(`"${name}" must be a positive integer`);
  }
  return parsed;
}

/** Slices `items` into a page based on `page` and `pageSize` query params. */
export function paginate<T>(
  items: T[],
  query: { page?: unknown; pageSize?: unknown } = {},
): Page<T> {
  const rawPageSize = parseIntegerParam(
    query.pageSize,
    "pageSize",
    DEFAULT_PAGE_SIZE,
  );
  const pageSize = Math.min(rawPageSize, MAX_PAGE_SIZE);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  const rawPage = parseIntegerParam(query.page, "page", 1);
  // Clamp a valid but out-of-range page to the last page — the acceptance
  // criteria explicitly note "keeping the clamp for valid integers beyond
  // totalPages" preserves useful UX for pagination overshoots.
  const page = Math.min(rawPage, totalPages);

  const start = (page - 1) * pageSize;

  return {
    items: items.slice(start, start + pageSize),
    page,
    pageSize,
    total: items.length,
    totalPages,
  };
}
