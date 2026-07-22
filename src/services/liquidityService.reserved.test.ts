import { LiquidityService } from "./liquidityService";
import { LiquidityRepository } from "../repositories/liquidityRepository";
import { SettlementService } from "./settlementService";
import { SettlementRepository } from "../repositories/settlementRepository";
import { AnchorService } from "./anchorService";
import { AnchorRepository } from "../repositories/anchorRepository";
import { ApiError } from "../errors/ApiError";

describe("LiquidityService reserved liquidity checks", () => {
  it("prevents withdrawal that would breach reserved liquidity", () => {
    const liquidityRepo = new LiquidityRepository();
    const settlementRepo = new SettlementRepository();
    const anchorRepo = new AnchorRepository();
    const anchors = new AnchorService(anchorRepo);
anchors.register({ id: "anchorA" });
    const settlements = new SettlementService(settlementRepo, liquidityRepo, anchors);
    const liquidity = new LiquidityService(liquidityRepo, settlements);

    // Add liquidity to pool
    liquidity.addLiquidity({ anchor: "anchorA", asset: "USDC", amount: 1000 });
    // Open a settlement that reserves 800 USDC
    settlements.open({ anchor: "anchorA", asset: "USDC", amount: 800 });

    // Attempt to withdraw 300 (total pool would become 700, less than reserved 800)
    expect(() =>
      liquidity.withdrawLiquidity({ anchor: "anchorA", asset: "USDC", amount: 300 })
    ).toThrow(ApiError);
    // Verify error code
    try {
      liquidity.withdrawLiquidity({ anchor: "anchorA", asset: "USDC", amount: 300 });
    } catch (e) {
      if (e instanceof ApiError) {
        expect(e.code).toBe("INSUFFICIENT_LIQUIDITY_RESERVED");
      } else {
        throw e;
      }
    }
  });
});
