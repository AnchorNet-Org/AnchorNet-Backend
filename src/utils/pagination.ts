/**
 * Offset-based pagination helper for in-memory collections.
 */

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), min), max);
}

/** Slices `items` into a page based on `page` and `pageSize` query params. */
export function paginate<T>(
  items: T[],
  query: { page?: unknown; pageSize?: unknown } = {},
): Page<T> {
  const pageSize = clampInt(query.pageSize, DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const page = clampInt(query.page, 1, 1, totalPages);
  const start = (page - 1) * pageSize;

  return {
    items: items.slice(start, start + pageSize),
    page,
    pageSize,
    total: items.length,
    totalPages,
  };
}
