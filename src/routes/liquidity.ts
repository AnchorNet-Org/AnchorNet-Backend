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

  // Withdraw (reduce) liquidity previously recorded for an anchor/asset pair.
  router.post("/withdraw", (req: Request, res: Response) => {
    const entry = service.withdrawLiquidity(req.body ?? {});
    res.json(entry);
  });

  // Atomically transfer liquidity between two anchors for the same asset.
  router.post("/transfer", (req: Request, res: Response) => {
    const result = service.transferLiquidity(req.body ?? {});
    res.json(result);
  });

  // List aggregated pools across all assets.
  router.get("/", (_req: Request, res: Response) => {
    res.json({ pools: service.listPools() });
  });

  // List raw per-anchor entries.
  router.get("/entries", (_req: Request, res: Response) => {
    res.json({ entries: service.listEntries() });
  });

  // Force-remove an anchor's entire liquidity entry for an asset.
  router.delete("/:anchor/:asset", (req: Request, res: Response) => {
    res.json(service.removeEntry(req.params.anchor, req.params.asset));
  });

  // Read the raw liquidity entries for a single anchor.
  router.get("/anchors/:anchor", (req: Request, res: Response) => {
    res.json({ entries: service.listByAnchor(req.params.anchor) });
  });

  // Read the aggregated pool for a single asset.
  router.get("/:asset", (req: Request, res: Response) => {
    res.json(service.getPool(req.params.asset));
  });

  return router;
}
