import { ApiError } from "../errors/ApiError";
import {
  CURSOR_DEFAULT_PAGE_SIZE,
  CURSOR_MAX_PAGE_SIZE,
  paginateByCursor,
} from "./cursorPagination";

interface Row {
  id: number;
  createdAt: string;
}

const rows = (count: number): Row[] => Array.from({ length: count }, (_, index) => ({
  id: count - index,
  createdAt: `2026-08-${String((index % 9) + 1).padStart(2, "0")}`,
}));

const descKey = (row: Row) => String(row.id).padStart(8, "0");

describe("paginateByCursor", () => {
  it("returns the default bounded page and an opaque cursor", () => {
    const page = paginateByCursor(rows(25), {
      keyOf: descKey,
      direction: "desc",
      scope: "rows",
    });

    expect(page.items).toHaveLength(CURSOR_DEFAULT_PAGE_SIZE);
    expect(page.pageSize).toBe(CURSOR_DEFAULT_PAGE_SIZE);
    expect(page.nextCursor).toEqual(expect.any(String));
    expect(page.nextCursor).not.toContain("snapshot");
    expect(page.nextCursor).not.toContain("after");
  });

  it("clamps an oversized page to the operational maximum", () => {
    const page = paginateByCursor(rows(150), {
      pageSize: "999999",
      keyOf: descKey,
      direction: "desc",
    });

    expect(page.items).toHaveLength(CURSOR_MAX_PAGE_SIZE);
    expect(page.pageSize).toBe(CURSOR_MAX_PAGE_SIZE);
  });

  it("rejects malformed and empty cursors", () => {
    for (const cursor of ["nope", "", "%%%", "eyJmb28iOiJiYXIifQ"]) {
      expect(() => paginateByCursor(rows(2), {
        cursor,
        keyOf: descKey,
        direction: "desc",
      })).toThrow(ApiError);
    }
  });

  it("rejects a cursor used with another direction or scope", () => {
    const first = paginateByCursor(rows(3), {
      pageSize: 1,
      keyOf: descKey,
      direction: "desc",
      scope: "one",
    });

    expect(() => paginateByCursor(rows(3), {
      cursor: first.nextCursor!,
      keyOf: descKey,
      direction: "asc",
      scope: "one",
    })).toThrow(ApiError);
    expect(() => paginateByCursor(rows(3), {
      cursor: first.nextCursor!,
      keyOf: descKey,
      direction: "desc",
      scope: "two",
    })).toThrow(ApiError);
  });

  it("traverses a complete descending collection without gaps or duplicates", () => {
    const source = rows(47);
    const seen: number[] = [];
    let cursor: string | undefined;

    do {
      const page = paginateByCursor(source, {
        cursor,
        pageSize: 7,
        keyOf: descKey,
        direction: "desc",
        scope: "traverse",
      });
      seen.push(...page.items.map((row) => row.id));
      cursor = page.nextCursor ?? undefined;
    } while (cursor);

    expect(seen).toEqual(source.map((row) => row.id));
    expect(new Set(seen).size).toBe(source.length);
  });

  it("traverses a complete ascending collection without gaps or duplicates", () => {
    const source = [...rows(31)].reverse();
    const keyOf = (row: Row) => String(row.id).padStart(8, "0");
    const sorted = [...source].sort((a, b) => keyOf(a).localeCompare(keyOf(b)));
    const seen: number[] = [];
    let cursor: string | undefined;

    do {
      const page = paginateByCursor(sorted, {
        cursor,
        pageSize: 4,
        keyOf,
        direction: "asc",
        scope: "ascending",
      });
      seen.push(...page.items.map((row) => row.id));
      cursor = page.nextCursor ?? undefined;
    } while (cursor);

    expect(seen).toEqual(sorted.map((row) => row.id));
  });

  it("holds the descending snapshot boundary when newer rows arrive", () => {
    const initial = rows(9);
    const first = paginateByCursor(initial, {
      pageSize: 3,
      keyOf: descKey,
      direction: "desc",
      scope: "snapshot",
    });
    const newer = [{ id: 999, createdAt: "2026-09-01" }, ...initial];
    const second = paginateByCursor(newer, {
      cursor: first.nextCursor!,
      pageSize: 10,
      keyOf: descKey,
      direction: "desc",
      scope: "snapshot",
    });

    expect(second.items.map((row) => row.id)).toEqual([6, 5, 4, 3, 2, 1]);
    expect(second.items.map((row) => row.id)).not.toContain(999);
  });

  it("returns a null cursor at the end of a collection", () => {
    const page = paginateByCursor(rows(2), {
      pageSize: 10,
      keyOf: descKey,
      direction: "desc",
    });
    expect(page.nextCursor).toBeNull();
  });

  it("returns an empty page for an empty collection", () => {
    expect(paginateByCursor<Row>([], { keyOf: descKey })).toEqual({
      items: [],
      pageSize: CURSOR_DEFAULT_PAGE_SIZE,
      nextCursor: null,
    });
  });

  it("rejects duplicate ordering keys instead of silently skipping data", () => {
    expect(() => paginateByCursor([{ id: 1 }, { id: 1 }], {
      keyOf: (row) => String(row.id),
    })).toThrow("unique ordering keys");
  });

  it("uses a unique tiebreaker when visible fields tie", () => {
    const tied = [
      { id: "b", createdAt: "2026-08-01" },
      { id: "a", createdAt: "2026-08-01" },
    ];
    const sorted = [...tied].sort((a, b) => a.id.localeCompare(b.id));
    const page = paginateByCursor(sorted, {
      pageSize: 1,
      keyOf: (row) => `${row.createdAt}\u0000${row.id}`,
    });
    expect(page.items[0].id).toBe("a");
    expect(page.nextCursor).toEqual(expect.any(String));
  });

  it("accepts numeric page sizes but rejects non-integers", () => {
    expect(paginateByCursor(rows(3), { pageSize: 2, direction: "desc", keyOf: descKey }).items).toHaveLength(2);
    for (const pageSize of [0, -1, 1.5, "1.5", "abc", [], {}]) {
      expect(() => paginateByCursor(rows(3), { pageSize, keyOf: descKey })).toThrow(ApiError);
    }
  });

  it("does not mutate caller-owned item ordering", () => {
    const source = rows(4);
    const original = [...source];
    paginateByCursor(source, { keyOf: descKey, direction: "desc" });
    expect(source).toEqual(original);
  });
});
