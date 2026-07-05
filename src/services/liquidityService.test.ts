import { LiquidityService } from "./liquidityService";
import { LiquidityRepository } from "../repositories/liquidityRepository";
import { ApiError } from "../errors/ApiError";

function makeService(): LiquidityService {
  return new LiquidityService(new LiquidityRepository());
}

describe("LiquidityService", () => {
  it("records liquidity and normalizes the asset code", () => {
    const service = makeService();
    const entry = service.addLiquidity({
      anchor: "anchorA",
      asset: "usdc",
      amount: 100,
    });

    expect(entry.asset).toBe("USDC");
    expect(entry.amount).toBe(100);
  });

  it("accumulates repeated contributions from the same anchor", () => {
    const service = makeService();
    service.addLiquidity({ anchor: "anchorA", asset: "USDC", amount: 100 });
    service.addLiquidity({ anchor: "anchorA", asset: "USDC", amount: 50 });

    expect(service.getPool("USDC").total).toBe(150);
    expect(service.getPool("USDC").anchors).toBe(1);
  });

  it("rejects non-positive amounts", () => {
    const service = makeService();
    expect(() =>
      service.addLiquidity({ anchor: "anchorA", asset: "USDC", amount: -5 }),
    ).toThrow(ApiError);
  });

  it("rejects a blank anchor", () => {
    const service = makeService();
    expect(() =>
      service.addLiquidity({ anchor: "  ", asset: "USDC", amount: 5 }),
    ).toThrow(ApiError);
  });

  it("lists pools sorted by asset", () => {
    const service = makeService();
    service.addLiquidity({ anchor: "anchorA", asset: "USDC", amount: 100 });
    service.addLiquidity({ anchor: "anchorB", asset: "EURC", amount: 40 });

    expect(service.listPools().map((p) => p.asset)).toEqual(["EURC", "USDC"]);
  });

  it("throws 404 for an unknown pool", () => {
    const service = makeService();
    expect(() => service.getPool("USDC")).toThrow(ApiError);
  });

  it("withdraws part of an anchor's balance", () => {
    const service = makeService();
    service.addLiquidity({ anchor: "anchorA", asset: "USDC", amount: 100 });

    const entry = service.withdrawLiquidity({
      anchor: "anchorA",
      asset: "usdc",
      amount: 40,
    });

    expect(entry.amount).toBe(60);
    expect(service.getPool("USDC").total).toBe(60);
  });

  it("removes the entry once the full balance is withdrawn", () => {
    const service = makeService();
    service.addLiquidity({ anchor: "anchorA", asset: "USDC", amount: 100 });

    const entry = service.withdrawLiquidity({
      anchor: "anchorA",
      asset: "USDC",
      amount: 100,
    });

    expect(entry.amount).toBe(0);
    expect(() => service.getPool("USDC")).toThrow(ApiError);
  });

  it("rejects withdrawing more than the available balance", () => {
    const service = makeService();
    service.addLiquidity({ anchor: "anchorA", asset: "USDC", amount: 100 });

    expect(() =>
      service.withdrawLiquidity({
        anchor: "anchorA",
        asset: "USDC",
        amount: 150,
      }),
    ).toThrow(ApiError);
  });

  it("throws 404 when the anchor has no balance to withdraw", () => {
    const service = makeService();
    expect(() =>
      service.withdrawLiquidity({
        anchor: "anchorA",
        asset: "USDC",
        amount: 10,
      }),
    ).toThrow(ApiError);
  });
});
