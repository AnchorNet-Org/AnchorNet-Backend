/**
 * Routes for recording and reading anchor liquidity.
 */

import { Router, Request, Response } from "express";
import { LiquidityService } from "../services/liquidityService";

export function liquidityRouter(service: LiquidityService): Router {
  const router = Router();

  // Record (or accumulate) liquidity for an anchor/asset pair.
  router.post("/", (req: Request, res: Response) => {
    const entry = service.addLiquidity(req.body ?? {});
    res.status(201).json(entry);
  });

  // List aggregated pools across all assets.
  router.get("/", (_req: Request, res: Response) => {
    res.json({ pools: service.listPools() });
  });

  // List raw per-anchor entries.
  router.get("/entries", (_req: Request, res: Response) => {
    res.json({ entries: service.listEntries() });
  });

  // Read the aggregated pool for a single asset.
  router.get("/:asset", (req: Request, res: Response) => {
    res.json(service.getPool(req.params.asset));
  });

  return router;
}
