/**
 * Routes for recording and reading anchor liquidity.
 */

import { Router, Request, Response } from "express";
import { ApiError } from "../errors/ApiError";
import { LiquidityService } from "../services/liquidityService";
import { paginateByCursor } from "../utils/cursorPagination";

export function liquidityRouter(service: LiquidityService): Router {
  const router = Router();

  // Record (or accumulate) liquidity for an anchor/asset pair.
  router.post("/", (req: Request, res: Response) => {
    const raw = req.body.amount;

    // Reject values that cannot represent a valid positive integer amount:
    // - null, undefined, boolean, arrays, plain objects
    // - NaN, Infinity, -Infinity  (non-finite numbers)
    // - negative zero
    // - numeric strings that are not finite positive integers ("abc", "1.5" would
    //   also be caught downstream, but we surface a clear 400 here)
    // NOTE: valid string amounts like "500" are allowed — the service converts them.
    const isInvalidNonString =
      raw === null ||
      raw === undefined ||
      typeof raw === "boolean" ||
      Array.isArray(raw) ||
      (typeof raw === "object" && raw !== null) ||
      (typeof raw === "number" && (!Number.isFinite(raw) || Object.is(raw, -0)));

    const isInvalidString =
      typeof raw === "string" && !/^\d+$/.test(raw.trim());

    if (isInvalidNonString || isInvalidString) {
      throw ApiError.badRequest('"amount" must be a positive finite number');
    }

    const entry = service.addLiquidity(req.body ?? {});
    res.status(201).json({ ...entry, amount: entry.amount.toString() });
  });

  // Withdraw (reduce) liquidity previously recorded for an anchor/asset pair.
  router.post("/withdraw", (req: Request, res: Response) => {
    const entry = service.withdrawLiquidity(req.body ?? {});
    res.json({ ...entry, amount: entry.amount.toString() });
  });

  // Atomically transfer liquidity between two anchors for the same asset.
  router.post("/transfer", (req: Request, res: Response) => {
    const result = service.transferLiquidity(req.body ?? {});
    res.json({
        from: { ...result.from, amount: result.from.amount.toString() },
        to: { ...result.to, amount: result.to.amount.toString() }
    });
  });

  // List aggregated pools across all assets.
  router.get("/", (req: Request, res: Response) => {
    const pools = service.listPools();
    const page = paginateByCursor(pools, {
      cursor: req.query.cursor,
      pageSize: req.query.pageSize,
      direction: "asc",
      scope: "liquidity-pools",
      keyOf: (pool) => pool.asset,
    });
    res.json({
      pools: page.items.map(p => ({ ...p, total: p.total.toString() })),
      pagination: { pageSize: page.pageSize, nextCursor: page.nextCursor },
    });
  });

  // ---------------------------------------------------------------------
  // ROUTE ORDER IS LOAD-BEARING.
  // ...
  // ---------------------------------------------------------------------

  // List raw per-anchor entries. Registered before the catch-all GET /:asset
  router.get("/entries", (req: Request, res: Response) => {
    const entries = service.listEntries().sort((a, b) =>
      `${a.anchor}\u0000${a.asset}`.localeCompare(`${b.anchor}\u0000${b.asset}`),
    );
    const page = paginateByCursor(entries, {
      cursor: req.query.cursor,
      pageSize: req.query.pageSize,
      direction: "asc",
      scope: "liquidity-entries",
      keyOf: (entry) => `${entry.anchor}\u0000${entry.asset}`,
    });
    res.json({
      entries: page.items.map(e => ({ ...e, amount: e.amount.toString() })),
      pagination: { pageSize: page.pageSize, nextCursor: page.nextCursor },
    });
  });

  // Read-only audit trail of successful withdrawals.
  router.get("/withdrawals", (req: Request, res: Response) => {
    const withdrawals = service.listWithdrawals();
    const page = paginateByCursor(withdrawals, {
      cursor: req.query.cursor,
      pageSize: req.query.pageSize,
      direction: "asc",
      scope: "liquidity-withdrawals",
      keyOf: (withdrawal, index) => `${withdrawal.timestamp}\u0000${String(index).padStart(12, "0")}`,
    });
    res.json({
      withdrawals: page.items.map(w => ({ ...w, amount: w.amount.toString(), remainingBalance: w.remainingBalance.toString() })),
      pagination: { pageSize: page.pageSize, nextCursor: page.nextCursor },
    });
  });

  // Force-remove an anchor's entire liquidity entry for an asset.
  router.delete("/:anchor/:asset", (req: Request, res: Response) => {
    const entry = service.removeEntry(req.params.anchor, req.params.asset);
    res.json({ ...entry, amount: entry.amount.toString() });
  });

  // Read the raw liquidity entries for a single anchor.
  router.get("/anchors/:anchor", (req: Request, res: Response) => {
    const entries = service.listByAnchor(req.params.anchor).sort((a, b) => a.asset.localeCompare(b.asset));
    const page = paginateByCursor(entries, {
      cursor: req.query.cursor,
      pageSize: req.query.pageSize,
      direction: "asc",
      scope: `liquidity-anchor:${req.params.anchor}`,
      keyOf: (entry) => entry.asset,
    });
    res.json({
      entries: page.items.map(e => ({ ...e, amount: e.amount.toString() })),
      pagination: { pageSize: page.pageSize, nextCursor: page.nextCursor },
    });
  });

  // Read the aggregated pool for a single asset.
  router.get("/:asset", (req: Request, res: Response) => {
    const pool = service.getPool(req.params.asset);
    res.json({ ...pool, total: pool.total.toString() });
  });

  return router;
}
