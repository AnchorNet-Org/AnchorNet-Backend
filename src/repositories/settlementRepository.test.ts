import { SettlementRepository } from "./settlementRepository";
import { Settlement, isSettlementStatus } from "../models/settlement";

function draft(anchor: string, amount: number): Omit<Settlement, "id"> {
  return {
    anchor,
    asset: "USDC",
    amount,
    fee: 0,
    status: "pending",
    createdAt: "2024-01-01T00:00:00.000Z",
  };
}

describe("SettlementRepository", () => {
  it("assigns incrementing ids", () => {
    const repo = new SettlementRepository();
    const first = repo.create(draft("anchorA", 100));
    const second = repo.create(draft("anchorB", 200));

    expect(first.id).toBe(1);
    expect(second.id).toBe(2);
    expect(repo.peekNextId()).toBe(3);
  });

  it("saves status changes", () => {
    const repo = new SettlementRepository();
    const created = repo.create(draft("anchorA", 100));
    repo.save({ ...created, status: "executed" });

    expect(repo.get(created.id)?.status).toBe("executed");
  });

  it("lists settlements most recent first", () => {
    const repo = new SettlementRepository();
    repo.create(draft("anchorA", 100));
    repo.create(draft("anchorB", 200));

    expect(repo.all().map((s) => s.id)).toEqual([2, 1]);
  });

  it("filters by anchor", () => {
    const repo = new SettlementRepository();
    repo.create(draft("anchorA", 100));
    repo.create(draft("anchorB", 200));
    repo.create(draft("anchorA", 300));

    expect(repo.byAnchor("anchorA")).toHaveLength(2);
    expect(repo.count()).toBe(3);
  });

  describe("remove", () => {
    it("removes an existing settlement and returns true", () => {
      const repo = new SettlementRepository();
      const s = repo.create(draft("anchorA", 100));
      expect(repo.count()).toBe(1);

      const result = repo.remove(s.id);
      expect(result).toBe(true);
      expect(repo.get(s.id)).toBeUndefined();
      expect(repo.count()).toBe(0);
      expect(repo.all()).toHaveLength(0);
      expect(repo.byAnchor("anchorA")).toHaveLength(0);
    });

    it("returns false when removing a non-existent id", () => {
      const repo = new SettlementRepository();
      repo.create(draft("anchorA", 100));

      const result = repo.remove(999);
      expect(result).toBe(false);
      expect(repo.count()).toBe(1);
    });
  });
});

describe("isSettlementStatus", () => {
  it("accepts all valid statuses", () => {
    expect(isSettlementStatus("pending")).toBe(true);
    expect(isSettlementStatus("executed")).toBe(true);
    expect(isSettlementStatus("cancelled")).toBe(true);
  });

  it("rejects invalid strings", () => {
    expect(isSettlementStatus("unknown")).toBe(false);
    expect(isSettlementStatus("")).toBe(false);
  });

  it("rejects near-miss strings (exact match only)", () => {
    expect(isSettlementStatus("Pending")).toBe(false);
    expect(isSettlementStatus("pending ")).toBe(false);
    expect(isSettlementStatus("PENDING")).toBe(false);
  });

  it("rejects non-string values", () => {
    expect(isSettlementStatus(123)).toBe(false);
    expect(isSettlementStatus(null)).toBe(false);
    expect(isSettlementStatus(undefined)).toBe(false);
    expect(isSettlementStatus({})).toBe(false);
  });
});

describe("SettlementRepository rejects invalid status", () => {
  it("save throws on invalid status", () => {
    const repo = new SettlementRepository();
    const created = repo.create(draft("anchorA", 100));
    const invalid = { ...created, status: "bogus" } as unknown as Settlement;

    expect(() => repo.save(invalid)).toThrow(/Invalid settlement status/);
  });

  it("create throws on invalid status", () => {
    const repo = new SettlementRepository();
    const invalid = {
      ...draft("anchorA", 100),
      status: "bogus",
    } as unknown as Omit<Settlement, "id">;

    expect(() => repo.create(invalid)).toThrow(/Invalid settlement status/);
  });
});
