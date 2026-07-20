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
});
