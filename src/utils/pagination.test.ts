import { paginate } from "./pagination";

const items = Array.from({ length: 25 }, (_, i) => i + 1);

describe("paginate", () => {
  it("returns the first page with default size", () => {
    const page = paginate(items);
    expect(page.items).toHaveLength(20);
    expect(page.items[0]).toBe(1);
    expect(page.total).toBe(25);
    expect(page.totalPages).toBe(2);
  });

  it("returns the requested page", () => {
    const page = paginate(items, { page: 2, pageSize: 10 });
    expect(page.items).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
    expect(page.page).toBe(2);
  });

  it("clamps page size to the maximum", () => {
    const page = paginate(items, { pageSize: 1000 });
    expect(page.pageSize).toBe(100);
  });

  it("clamps an out-of-range page to the last page", () => {
    const page = paginate(items, { page: 99, pageSize: 10 });
    expect(page.page).toBe(3);
    expect(page.items).toEqual([21, 22, 23, 24, 25]);
  });

  it("falls back to defaults for invalid input", () => {
    const page = paginate(items, { page: "x", pageSize: "y" });
    expect(page.page).toBe(1);
    expect(page.pageSize).toBe(20);
  });
});
