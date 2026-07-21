import { applySort } from "./sorting";
import { ApiError } from "../errors/ApiError";

const items = [
  { id: "b", amount: 20 },
  { id: "a", amount: 30 },
  { id: "c", amount: 10 },
];

const numericItems = [
  { amount: 10, fee: 2 },
  { amount: 9, fee: 1 },
  { amount: 100, fee: 15 },
];

describe("applySort", () => {
  it("returns items unchanged when no sort is requested", () => {
    expect(applySort(items, {}, ["id", "amount"])).toBe(items);
  });

  it("sorts numeric fields ascending by default", () => {
    const sorted = applySort(items, { sort: "amount" }, ["id", "amount"]);
    expect(sorted.map((i) => i.amount)).toEqual([10, 20, 30]);
  });

  it("sorts numeric fields with 9 and 10 numerically ascending", () => {
    const sorted = applySort(numericItems, { sort: "amount" }, ["amount", "fee"]);
    expect(sorted.map((i) => i.amount)).toEqual([9, 10, 100]);
  });

  it("sorts numeric fields with 9 and 10 numerically descending", () => {
    const sorted = applySort(numericItems, { sort: "amount", order: "desc" }, ["amount", "fee"]);
    expect(sorted.map((i) => i.amount)).toEqual([100, 10, 9]);
  });

  it("sorts fee numeric field numerically", () => {
    const sorted = applySort(numericItems, { sort: "fee" }, ["amount", "fee"]);
    expect(sorted.map((i) => i.fee)).toEqual([1, 2, 15]);
  });

  it("sorts numeric fields descending when requested", () => {
    const sorted = applySort(items, { sort: "amount", order: "desc" }, [
      "id",
      "amount",
    ]);
    expect(sorted.map((i) => i.amount)).toEqual([30, 20, 10]);
  });

  it("sorts string fields", () => {
    const sorted = applySort(items, { sort: "id" }, ["id", "amount"]);
    expect(sorted.map((i) => i.id)).toEqual(["a", "b", "c"]);
  });

  it("does not mutate the input array", () => {
    const copy = [...items];
    applySort(items, { sort: "amount" }, ["id", "amount"]);
    expect(items).toEqual(copy);
  });

  it("rejects an unknown sort field", () => {
    expect(() => applySort(items, { sort: "bogus" }, ["id", "amount"])).toThrow(
      ApiError,
    );
  });

  it("rejects an invalid order value", () => {
    expect(() =>
      applySort(items, { sort: "id", order: "sideways" }, ["id", "amount"]),
    ).toThrow(ApiError);
  });

  it("sorts by two fields with comma-separated sort", () => {
    const multi = [
      { id: "a", amount: 10 },
      { id: "b", amount: 10 },
      { id: "c", amount: 20 },
    ];
    const sorted = applySort(
      multi,
      { sort: "amount,id" },
      ["id", "amount"],
    );
    expect(sorted.map((i) => `${i.amount}-${i.id}`)).toEqual([
      "10-a",
      "10-b",
      "20-c",
    ]);
  });

  it("sorts by two fields with per-field order", () => {
    const multi = [
      { id: "a", amount: 10 },
      { id: "b", amount: 10 },
      { id: "c", amount: 20 },
    ];
    const sorted = applySort(
      multi,
      { sort: "amount,id", order: "desc,asc" },
      ["id", "amount"],
    );
    expect(sorted.map((i) => `${i.amount}-${i.id}`)).toEqual([
      "20-c",
      "10-a",
      "10-b",
    ]);
  });

  it("sorts by three fields", () => {
    const triple = [
      { id: "a", amount: 10, extra: 1 },
      { id: "b", amount: 10, extra: 2 },
      { id: "c", amount: 20, extra: 1 },
      { id: "d", amount: 10, extra: 1 },
    ];
    const sorted = applySort(
      triple,
      { sort: "amount,id,extra" },
      ["id", "amount", "extra"],
    );
    expect(sorted.map((i) => `${i.amount}-${i.id}-${i.extra}`)).toEqual([
      "10-a-1",
      "10-b-2",
      "10-d-1",
      "20-c-1",
    ]);
  });

  it("rejects an unknown field anywhere in a multi-field sort", () => {
    expect(() =>
      applySort(
        items,
        { sort: "id,bogus" },
        ["id", "amount"],
      ),
    ).toThrow(ApiError);
  });

  it("rejects mismatched sort/order lengths", () => {
    expect(() =>
      applySort(
        items,
        { sort: "id,amount", order: "asc" },
        ["id", "amount"],
      ),
    ).toThrow(ApiError);
  });
});
