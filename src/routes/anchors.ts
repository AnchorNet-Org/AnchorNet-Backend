/**
 * Routes for managing registered anchors.
 */

import { Router, Request, Response } from "express";
import { AnchorService } from "../services/anchorService";
import { SettlementService } from "../services/settlementService";
import { applySort } from "../utils/sorting";
import { paginate } from "../utils/pagination";
import { toCsv } from "../utils/csv";

const SORTABLE_FIELDS = ["id", "name", "registeredAt"];
const CSV_COLUMNS = ["id", "name", "registeredAt", "active"];

const SETTLEMENT_SORTABLE_FIELDS = ["id", "amount", "fee", "status", "createdAt"];
const SETTLEMENT_CSV_COLUMNS = [
  "id",
  "anchor",
  "asset",
  "amount",
  "fee",
  "status",
  "createdAt",
  "cancelReason",
];

export function anchorRouter(service: AnchorService, settlements?: SettlementService): Router {
  const router = Router();

  // Register a new anchor.
  router.post("/", (req: Request, res: Response) => {
    const anchor = service.register(req.body ?? {});
    res.status(201).json(anchor);
  });

  // Register a batch of anchors atomically.
  router.post("/bulk", (req: Request, res: Response) => {
    const anchors = service.registerBulk((req.body ?? {}).anchors);
    res.status(201).json({ anchors });
  });

  // List anchors, optionally filtered via ?status=active|inactive and/or a
  // free-text ?q= search over id/name, sorted via ?sort=id|name|registeredAt
  // and ?order=asc|desc, and exported as CSV via ?format=csv.
  router.get("/", (req: Request, res: Response) => {
    const anchors = applySort(
      service.list({ status: req.query.status, q: req.query.q }),
      { sort: req.query.sort, order: req.query.order },
      SORTABLE_FIELDS,
    );

    if (req.query.format === "csv") {
      res.type("text/csv").send(toCsv(anchors, CSV_COLUMNS));
      return;
    }

    res.json({ anchors });
  });

  // Read a single anchor by id.
  router.get("/:id", (req: Request, res: Response) => {
    res.json(service.get(req.params.id));
  });

  // Partially update an anchor's mutable fields (currently just `name`).
  router.patch("/:id", (req: Request, res: Response) => {
    res.json(service.update(req.params.id, req.body ?? {}));
  });

  // Deactivate an anchor.
  router.delete("/:id", (req: Request, res: Response) => {
    res.json(service.deregister(req.params.id));
  });

  // Reactivate a previously deactivated anchor.
  router.post("/:id/reactivate", (req: Request, res: Response) => {
    res.json(service.reactivate(req.params.id));
  });

  // List settlements for a specific anchor, scoped by its id.
  // Returns 404 if the anchor does not exist.
  // Supports ?sort=, ?order=, ?page=, ?pageSize=, and ?format=csv.
  router.get("/:id/settlements", (req: Request, res: Response) => {
    // Validate anchor existence — throws 404 if unknown.
    service.get(req.params.id);

    if (!settlements) {
      res.status(501).json({ error: { code: "NOT_IMPLEMENTED", message: "settlements service unavailable" } });
      return;
    }

    const sorted = applySort(
      settlements.list({ anchor: req.params.id }),
      { sort: req.query.sort, order: req.query.order },
      SETTLEMENT_SORTABLE_FIELDS,
    );

    if (req.query.format === "csv") {
      res.type("text/csv").send(toCsv(sorted, SETTLEMENT_CSV_COLUMNS));
      return;
    }

    const page = paginate(sorted, {
      page: req.query.page,
      pageSize: req.query.pageSize,
    });
    res.json({ settlements: page.items, pagination: { ...page, items: undefined } });
  });

  return router;
}
