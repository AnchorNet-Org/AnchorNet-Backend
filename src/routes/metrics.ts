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
  snapshotIntervalMs?: number;
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
      activeAnchors: anchors.filter((a) => a.active).length,
      pools: pools.length,
      totalLiquidity: pools.reduce((sum, p) => sum + p.total, 0),
      settlements: settlements.length,
      pendingSettlements: settlements.filter((s) => s.status === "pending")
        .length,
    };
  }

  function recordSnapshot(): MetricsSnapshot {
    const current = snapshot();
    history.push({ ...current, timestamp: new Date().toISOString() });
    return current;
  }

  if (deps.snapshotIntervalMs && deps.snapshotIntervalMs > 0) {
    const timer = setInterval(() => {
      recordSnapshot();
    }, deps.snapshotIntervalMs);
    timer.unref(); // Ensure interval doesn't block graceful shutdown
  }

  // Current aggregate metrics. Each read also records a snapshot for
  // GET /history, giving a rolling view of how the network changes over time.
  // Note: If snapshotIntervalMs is configured, read-triggered snapshots are still
  // preserved for backward compatibility, though this may result in more dense
  // snapshotting if the endpoint is read frequently.
  router.get("/", (_req: Request, res: Response) => {
    const current = recordSnapshot();
    res.json(current);
  });

  // The last (up to) `MAX_HISTORY` metrics snapshots, oldest first.
  router.get("/history", (_req: Request, res: Response) => {
    res.json({ snapshots: history.all() });
  });

  return router;
}
