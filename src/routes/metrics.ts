/**
 * Aggregate network metrics endpoint.
 */

import { Router, Request, Response } from "express";
import { LiquidityService } from "../services/liquidityService";
import { AnchorService } from "../services/anchorService";
import { SettlementService } from "../services/settlementService";

export function metricsRouter(deps: {
  liquidity: LiquidityService;
  anchors: AnchorService;
  settlements: SettlementService;
}): Router {
  const router = Router();

  router.get("/", (_req: Request, res: Response) => {
    const pools = deps.liquidity.listPools();
    const anchors = deps.anchors.list();
    const settlements = deps.settlements.list();

    res.json({
      anchors: anchors.length,
      activeAnchors: anchors.filter((a) => a.active).length,
      pools: pools.length,
      totalLiquidity: pools.reduce((sum, p) => sum + p.total, 0),
      settlements: settlements.length,
      pendingSettlements: settlements.filter((s) => s.status === "pending")
        .length,
    });
  });

  return router;
}
