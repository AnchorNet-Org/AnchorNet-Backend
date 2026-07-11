/**
 * Generic sort helper for in-memory list endpoints.
 */

import { ApiError } from "../errors/ApiError";

export interface SortQuery {
  sort?: unknown;
  order?: unknown;
}

/**
 * Sorts a copy of `items` by the field named in `query.sort`, restricted to
 * `allowedFields`. `query.order` selects `"asc"` (default) or `"desc"`.
 * Returns `items` unchanged when no `sort` is given. Throws a 400 for an
 * unknown field or an `order` other than `"asc"`/`"desc"`.
 */
export function applySort<T>(
  items: T[],
  query: SortQuery,
  allowedFields: readonly string[],
): T[] {
  if (query.sort === undefined) {
    return items;
  }

  const field = String(query.sort);
  if (!allowedFields.includes(field)) {
    throw ApiError.badRequest(
      `"sort" must be one of: ${allowedFields.join(", ")}`,
    );
  }

  const orderInput = query.order === undefined ? "asc" : String(query.order);
  if (orderInput !== "asc" && orderInput !== "desc") {
    throw ApiError.badRequest('"order" must be "asc" or "desc"');
  }
  const direction = orderInput === "asc" ? 1 : -1;

  return [...items].sort((a, b) => {
    const av = (a as Record<string, unknown>)[field];
    const bv = (b as Record<string, unknown>)[field];
    if (typeof av === "number" && typeof bv === "number") {
      return (av - bv) * direction;
    }
    return String(av).localeCompare(String(bv)) * direction;
  });
}
