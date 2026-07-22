/**
 * Aggregate network metrics endpoint.
 */

import { Router, Request, Response } from "express";
import { LiquidityService } from "../services/liquidityService";
import { AnchorService } from "../services/anchorService";
import { SettlementService } from "../services/settlementService";
import { BoundedHistory } from "../utils/history";

/** Maximum number of metrics snapshots retained for `GET /history`. */
const MAX_HISTORY = 50;

interface MetricsSnapshot {
  anchors: number;
  activeAnchors: number;
  pools: number;
  totalLiquidity: number;
  settlements: number;
  pendingSettlements: number;
}

export function metricsRouter(deps: {
  liquidity: LiquidityService;
  anchors: AnchorService;
  settlements: SettlementService;
}): Router {
  const router = Router();
  const history = new BoundedHistory<MetricsSnapshot & { timestamp: string }>(
    MAX_HISTORY,
  );

  function snapshot(): MetricsSnapshot {
    const pools = deps.liquidity.listPools();
    const anchors = deps.anchors.list();
    const settlements = deps.settlements.list();

    return {
      anchors: anchors.length,
      activeAnchors: deps.anchors.countActive(),
      pools: pools.length,
      totalLiquidity: pools.reduce((sum, p) => sum + p.total, 0),
      settlements: settlements.length,
      pendingSettlements: settlements.filter((s) => s.status === "pending")
        .length,
    };
  }

  // Current aggregate metrics. Each read also records a snapshot for
  // GET /history, giving a rolling view of how the network changes over time.
  router.get("/", (_req: Request, res: Response) => {
    const current = snapshot();
    history.push({ ...current, timestamp: new Date().toISOString() });
    res.json(current);
  });

  // The last (up to) `MAX_HISTORY` metrics snapshots, oldest first.
  router.get("/history", (_req: Request, res: Response) => {
    res.json({ snapshots: history.all() });
  });

  return router;
}
