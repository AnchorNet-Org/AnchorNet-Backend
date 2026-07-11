import { applySort } from "./sorting";
import { ApiError } from "../errors/ApiError";

const items = [
  { id: "b", amount: 20 },
  { id: "a", amount: 30 },
  { id: "c", amount: 10 },
];

describe("applySort", () => {
  it("returns items unchanged when no sort is requested", () => {
    expect(applySort(items, {}, ["id", "amount"])).toBe(items);
  });

  it("sorts numeric fields ascending by default", () => {
    const sorted = applySort(items, { sort: "amount" }, ["id", "amount"]);
    expect(sorted.map((i) => i.amount)).toEqual([10, 20, 30]);
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
