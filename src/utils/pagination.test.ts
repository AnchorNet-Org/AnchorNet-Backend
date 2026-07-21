import { paginate } from "./pagination";
import { ApiError } from "../errors/ApiError";

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

  it("throws ApiError for a non-numeric page", () => {
    expect(() => paginate(items, { page: "x" })).toThrow(ApiError);
    expect(() => paginate(items, { page: "x" })).toThrow(
      /"page" must be a positive integer/,
    );
  });

  it("throws ApiError for a non-numeric pageSize", () => {
    expect(() => paginate(items, { pageSize: "y" })).toThrow(ApiError);
  });
});

describe("paginate — omitted / empty / garbage distinction (#108)", () => {
  it("uses defaults when page/pageSize are omitted", () => {
    const p = paginate(items);
    expect(p.page).toBe(1);
    expect(p.pageSize).toBe(20);
  });

  it("uses defaults when page/pageSize are empty strings", () => {
    const p = paginate(items, { page: "", pageSize: "" });
    expect(p.page).toBe(1);
    expect(p.pageSize).toBe(20);
  });

  it("rejects a fractional page with 400", () => {
    expect(() => paginate(items, { page: "1.5" })).toThrow(ApiError);
  });

  it("rejects a negative page with 400", () => {
    expect(() => paginate(items, { page: "-1" })).toThrow(ApiError);
  });

  it("rejects page=0 with 400", () => {
    expect(() => paginate(items, { page: "0" })).toThrow(ApiError);
  });

  it("rejects an array-valued page with 400", () => {
    // Express parses ?page=1&page=2 as ["1","2"]
    expect(() => paginate(items, { page: ["1", "2"] as unknown })).toThrow(
      ApiError,
    );
  });
});

describe("paginate — preserves documented clamps (#108)", () => {
  it("still clamps a valid page beyond totalPages to the last page", () => {
    const p = paginate(items, { page: "99", pageSize: "10" });
    expect(p.page).toBe(3);
  });

  it("still clamps pageSize above MAX_PAGE_SIZE", () => {
    const p = paginate(items, { pageSize: "1000" });
    expect(p.pageSize).toBe(100);
  });
});
