import { BoundedHistory } from "./history";

describe("BoundedHistory", () => {
  it("returns pushed items oldest first", () => {
    const history = new BoundedHistory<number>(5);
    history.push(1);
    history.push(2);
    history.push(3);

    expect(history.all()).toEqual([1, 2, 3]);
    expect(history.size()).toBe(3);
  });

  it("evicts the oldest entry once over the limit", () => {
    const history = new BoundedHistory<number>(3);
    history.push(1);
    history.push(2);
    history.push(3);
    history.push(4);

    expect(history.all()).toEqual([2, 3, 4]);
    expect(history.size()).toBe(3);
  });

  it("returns a copy that does not allow external mutation", () => {
    const history = new BoundedHistory<number>(3);
    history.push(1);

    const snapshot = history.all();
    snapshot.push(999);

    expect(history.all()).toEqual([1]);
  });

  it("starts empty", () => {
    const history = new BoundedHistory<number>(3);
    expect(history.all()).toEqual([]);
    expect(history.size()).toBe(0);
  });

  it("throws for a zero limit", () => {
    expect(() => new BoundedHistory(0)).toThrow(/positive integer/);
  });

  it("throws for a non-integer limit", () => {
    expect(() => new BoundedHistory(1.5)).toThrow(/positive integer/);
  });
});
