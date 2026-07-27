/**
 * Aggregate network metrics endpoint.
 */

import { Router, Request, Response } from "express";
import { LiquidityService } from "../services/liquidityService";
import { AnchorService } from "../services/anchorService";
import { SettlementService } from "../services/settlementService";
import { ApiError } from "../errors/ApiError";
import { BoundedHistory } from "../utils/history";

/** Maximum number of metrics snapshots retained for `GET /history`. */
const MAX_HISTORY = 50;

/**
 * A point-in-time view of the network's aggregate state.
 *
 * Count fields (`settlements`, `pendingSettlements`) answer "how many?",
 * whereas the value fields (`totalSettledAmount`, `totalFeesCollected`)
 * answer "how much?" so an operator can read total value settled and total
 * protocol fees earned without fetching every settlement and summing them
 * client-side.
 */
export interface MetricsSnapshot {
  /** Total registered anchors, active or not. */
  anchors: number;
  /** Registered anchors that are currently active. */
  activeAnchors: number;
  /** Number of distinct asset pools holding liquidity. */
  pools: number;
  /** Sum of pool totals across every asset. */
  totalLiquidity: number;
  /** Total settlements in any lifecycle state. */
  settlements: number;
  /** Settlements still reserving liquidity (`status === "pending"`). */
  pendingSettlements: number;
  /**
   * Gross value settled: the sum of `amount` over **executed** settlements
   * only. Pending settlements have merely reserved liquidity (and may still
   * be cancelled) and cancelled settlements never moved value, so neither
   * contributes.
   */
  totalSettledAmount: number;
  /**
   * Protocol fees actually earned: the sum of `fee` over **executed**
   * settlements only, for the same reason as {@link totalSettledAmount}.
   */
  totalFeesCollected: number;
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

    // Value settled and fees earned count only executed settlements: a
    // `pending` settlement has reserved liquidity but may still be cancelled,
    // and a `cancelled` one released it without ever moving value.
    const executed = settlements.filter((s) => s.status === "executed");

    return {
      anchors: anchors.length,
      activeAnchors: deps.anchors.countActive(),
      pools: pools.length,
      totalLiquidity: pools.reduce((sum, p) => sum + p.total, 0),
      settlements: settlements.length,
      pendingSettlements: settlements.filter((s) => s.status === "pending")
        .length,
      totalSettledAmount: executed.reduce((sum, s) => sum + s.amount, 0),
      totalFeesCollected: executed.reduce((sum, s) => sum + s.fee, 0),
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
  // When ?since=<ISO-8601 timestamp> is provided, only snapshots with a
  // timestamp strictly after that point are returned.
  router.get("/history", (req: Request, res: Response) => {
    const since = req.query.since;
    const snapshots = history.all();

    if (since === undefined) {
      res.json({ snapshots });
      return;
    }

    if (typeof since !== "string") {
      throw ApiError.badRequest('"since" must be a valid ISO-8601 timestamp');
    }

    const sinceTime = new Date(since).getTime();
    if (Number.isNaN(sinceTime)) {
      throw ApiError.badRequest('"since" must be a valid ISO-8601 timestamp');
    }

    res.json({
      snapshots: snapshots.filter(
        (snapshot) => new Date(snapshot.timestamp).getTime() > sinceTime,
      ),
    });
  });

  return router;
}
