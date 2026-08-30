import { ApiError } from "../errors/ApiError";

export type CursorDirection = "asc" | "desc";

export interface CursorPage<T> {
  items: T[];
  pageSize: number;
  nextCursor: string | null;
}

interface CursorPayload {
  version: 1;
  direction: CursorDirection;
  snapshot: string;
  after: string;
  scope?: string;
}

export const CURSOR_DEFAULT_PAGE_SIZE = 20;
export const CURSOR_MAX_PAGE_SIZE = 100;

function parsePageSize(value: unknown): number {
  if (value === undefined || value === "") return CURSOR_DEFAULT_PAGE_SIZE;
  if (typeof value !== "string" && typeof value !== "number") {
    throw ApiError.badRequest('"pageSize" must be a positive integer');
  }
  const raw = String(value);
  if (!/^\d+$/.test(raw) || Number(raw) < 1) {
    throw ApiError.badRequest('"pageSize" must be a positive integer');
  }
  return Math.min(Number(raw), CURSOR_MAX_PAGE_SIZE);
}

function encode(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decode(value: unknown, direction: CursorDirection, scope?: string): CursorPayload {
  if (typeof value !== "string" || value.length === 0) {
    throw ApiError.badRequest("cursor is malformed or expired");
  }
  try {
    const payload = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<CursorPayload>;
    if (
      payload.version !== 1 ||
      payload.direction !== direction ||
      typeof payload.snapshot !== "string" ||
      typeof payload.after !== "string" ||
      (scope !== undefined && payload.scope !== scope)
    ) {
      throw new Error("invalid cursor payload");
    }
    return payload as CursorPayload;
  } catch {
    throw ApiError.badRequest("cursor is malformed or expired");
  }
}

/**
 * Page a pre-sorted collection using an opaque, stable compound cursor.
 * `keyOf` must return a unique key in the same order as `items`; callers use a
 * deterministic tiebreaker such as an id when the visible sort field ties.
 */
export function paginateByCursor<T>(
  items: T[],
  options: {
    cursor?: unknown;
    pageSize?: unknown;
    direction?: CursorDirection;
    scope?: string;
    keyOf: (item: T, index: number) => string;
  },
): CursorPage<T> {
  const direction = options.direction ?? "asc";
  const pageSize = parsePageSize(options.pageSize);
  const keys = items.map(options.keyOf);

  if (new Set(keys).size !== keys.length) {
    throw new Error("cursor pagination requires unique ordering keys");
  }

  const supplied = options.cursor === undefined
    ? undefined
    : decode(options.cursor, direction, options.scope);
  if (items.length === 0) return { items: [], pageSize, nextCursor: null };
  const snapshot = supplied?.snapshot ?? keys[0];
  const startAfter = supplied?.after;
  const visible = items.filter((_item, index) => {
    const key = keys[index];
    const insideSnapshot = direction === "desc" ? key <= snapshot : key >= snapshot;
    const afterCursor = startAfter === undefined
      ? true
      : direction === "desc" ? key < startAfter : key > startAfter;
    return insideSnapshot && afterCursor;
  });
  const pageItems = visible.slice(0, pageSize);
  const hasMore = visible.length > pageItems.length;
  const lastIndex = pageItems.length - 1;
  const lastItem = pageItems[lastIndex];
  const lastOriginalIndex = lastItem === undefined ? -1 : items.indexOf(lastItem);

  return {
    items: pageItems,
    pageSize,
    nextCursor: hasMore && lastOriginalIndex >= 0
      ? encode({
          version: 1,
          direction,
          snapshot,
          after: options.keyOf(lastItem!, lastOriginalIndex),
          scope: options.scope,
        })
      : null,
  };
}
