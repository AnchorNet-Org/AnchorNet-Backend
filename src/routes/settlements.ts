/**
 * Routes for opening and managing settlements.
 */

import { Router, Request, Response } from "express";
import { SettlementService } from "../services/settlementService";
import { paginate } from "../utils/pagination";
import { applySort } from "../utils/sorting";

const SORTABLE_FIELDS = ["id", "amount", "fee", "status", "createdAt"];

export function settlementRouter(service: SettlementService): Router {
  const router = Router();

  // Open a new settlement, reserving liquidity.
  router.post("/", (req: Request, res: Response) => {
    res.status(201).json(service.open(req.body ?? {}));
  });

  // List settlements, optionally filtered by ?anchor= and ?asset=, sorted via
  // ?sort= and ?order=, and paginated via ?page= and ?pageSize=.
  router.get("/", (req: Request, res: Response) => {
    const anchor =
      typeof req.query.anchor === "string" ? req.query.anchor : undefined;
    const asset =
      typeof req.query.asset === "string"
        ? req.query.asset.toUpperCase()
        : undefined;
    const sorted = applySort(
      service.list({ anchor, asset }),
      { sort: req.query.sort, order: req.query.order },
      SORTABLE_FIELDS,
    );
    const page = paginate(sorted, {
      page: req.query.page,
      pageSize: req.query.pageSize,
    });
    res.json({ settlements: page.items, pagination: { ...page, items: undefined } });
  });

  // Read a single settlement.
  router.get("/:id", (req: Request, res: Response) => {
    res.json(service.get(req.params.id));
  });

  // Execute a pending settlement.
  router.post("/:id/execute", (req: Request, res: Response) => {
    res.json(service.execute(req.params.id));
  });

  // Cancel a pending settlement.
  router.post("/:id/cancel", (req: Request, res: Response) => {
    res.json(service.cancel(req.params.id));
  });

  return router;
}
