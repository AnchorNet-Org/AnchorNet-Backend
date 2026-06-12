import { QuoteService } from "./quoteService";
import { LiquidityService } from "./liquidityService";
import { LiquidityRepository } from "../repositories/liquidityRepository";
import { ApiError } from "../errors/ApiError";

function seed() {
  const repo = new LiquidityRepository();
  const liquidity = new LiquidityService(repo);
  liquidity.addLiquidity({ anchor: "big", asset: "USDC", amount: 1000 });
  liquidity.addLiquidity({ anchor: "mid", asset: "USDC", amount: 400 });
  liquidity.addLiquidity({ anchor: "small", asset: "USDC", amount: 100 });
  return repo;
}

describe("QuoteService", () => {
  it("routes through the largest anchor first", () => {
    const quote = new QuoteService(seed()).quote({
      asset: "USDC",
      amount: 500,
    });

    expect(quote.route).toEqual(["big"]);
  });

  it("adds more anchors until the amount is covered", () => {
    const quote = new QuoteService(seed()).quote({
      asset: "USDC",
      amount: 1200,
    });

    expect(quote.route).toEqual(["big", "mid"]);
  });

  it("applies the protocol fee and reports the deliverable", () => {
    const repo = new LiquidityRepository();
    new LiquidityService(repo).addLiquidity({
      anchor: "whale",
      asset: "USDC",
      amount: 50_000,
    });

    const quote = new QuoteService(repo, 10).quote({
      asset: "USDC",
      amount: 10_000,
    });

    expect(quote.fee).toBe(10);
    expect(quote.deliverable).toBe(9_990);
  });

  it("rounds the fee up for small amounts", () => {
    const quote = new QuoteService(seed(), 10).quote({
      asset: "USDC",
      amount: 100,
    });

    expect(quote.fee).toBe(1);
  });

  it("rejects requests that exceed available liquidity", () => {
    expect(() =>
      new QuoteService(seed()).quote({ asset: "USDC", amount: 5_000 }),
    ).toThrow(ApiError);
  });
});
