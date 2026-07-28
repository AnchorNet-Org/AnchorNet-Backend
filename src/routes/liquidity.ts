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

  // ---------------------------------------------------------------------
  // ROUTE ORDER IS LOAD-BEARING.
  //
  // Every static single-segment GET below (`/entries`, `/withdrawals`) MUST
  // stay registered BEFORE the catch-all `GET /:asset`. Express matches
  // routes in registration order, so if `/:asset` were moved (or a static
  // route moved after it), a request to `/api/v1/liquidity/entries` would be
  // matched as `getPool("ENTRIES")` and return 404 (or, worse, a pool object
  // if an asset literally named "ENTRIES" existed) instead of the entries
  // list. Do not reorder these `router.get(...)` calls; the regression tests
  // in `liquidity.test.ts` ("the /entries static route takes precedence over
  // /:asset") fail if they are swapped.
  // ---------------------------------------------------------------------

  // List raw per-anchor entries. Registered before the catch-all GET /:asset
  // so it is never shadowed by a single-segment asset lookup.
  router.get("/entries", (_req: Request, res: Response) => {
    res.json({ entries: service.listEntries() });
  });

  // Read-only audit trail of successful withdrawals (amount, resulting balance,
  // timestamp). Registered before the catch-all GET /:asset so it is never
  // shadowed by a single-segment asset lookup.
  router.get("/withdrawals", (_req: Request, res: Response) => {
    res.json({ withdrawals: service.listWithdrawals() });
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
  //
  // CATCH-ALL: this parameterized route matches ANY single path segment, so it
  // must remain the LAST GET registration in this router. Registering it above
  // `/entries`, `/withdrawals`, or `/anchors/:anchor` would silently shadow
  // them. See the ordering note above `router.get("/entries", ...)`.
  router.get("/:asset", (req: Request, res: Response) => {
    res.json(service.getPool(req.params.asset));
  });

  return router;
}
