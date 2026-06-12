import { LiquidityRepository } from "./liquidityRepository";
import { LiquidityEntry } from "../models/liquidity";

function entry(
  anchor: string,
  asset: string,
  amount: number,
): LiquidityEntry {
  return { anchor, asset, amount, updatedAt: "2024-01-01T00:00:00.000Z" };
}

describe("LiquidityRepository", () => {
  it("upserts and retrieves entries by anchor and asset", () => {
    const repo = new LiquidityRepository();
    repo.upsert(entry("anchorA", "USDC", 100));

    expect(repo.get("anchorA", "USDC")?.amount).toBe(100);
    expect(repo.get("anchorA", "EURC")).toBeUndefined();
  });

  it("replaces an existing entry on upsert", () => {
    const repo = new LiquidityRepository();
    repo.upsert(entry("anchorA", "USDC", 100));
    repo.upsert(entry("anchorA", "USDC", 250));

    expect(repo.all()).toHaveLength(1);
    expect(repo.get("anchorA", "USDC")?.amount).toBe(250);
  });

  it("filters entries by asset", () => {
    const repo = new LiquidityRepository();
    repo.upsert(entry("anchorA", "USDC", 100));
    repo.upsert(entry("anchorB", "USDC", 50));
    repo.upsert(entry("anchorA", "EURC", 75));

    expect(repo.byAsset("USDC")).toHaveLength(2);
    expect(repo.byAsset("EURC")).toHaveLength(1);
  });

  it("aggregates pools per asset", () => {
    const repo = new LiquidityRepository();
    repo.upsert(entry("anchorA", "USDC", 100));
    repo.upsert(entry("anchorB", "USDC", 50));

    const pools = repo.pools();
    const usdc = pools.find((p) => p.asset === "USDC");
    expect(usdc).toEqual({ asset: "USDC", total: 150, anchors: 2 });
  });

  it("removes entries", () => {
    const repo = new LiquidityRepository();
    repo.upsert(entry("anchorA", "USDC", 100));

    expect(repo.remove("anchorA", "USDC")).toBe(true);
    expect(repo.remove("anchorA", "USDC")).toBe(false);
    expect(repo.all()).toHaveLength(0);
  });
});
