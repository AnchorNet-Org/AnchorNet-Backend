/**
 * Routes for managing registered anchors.
 */

import { Router, Request, Response, NextFunction } from "express";
import { AnchorService } from "../services/anchorService";
import { SettlementService } from "../services/settlementService";
import { Anchor } from "../models/anchor";
import { Settlement } from "../models/settlement";
import { applySort } from "../utils/sorting";
import { paginate } from "../utils/pagination";
import { paginateByCursor } from "../utils/cursorPagination";
import { csvColumnsFor, toCsv } from "../utils/csv";
import { optionalBooleanFlag } from "../utils/validation";
import { ApiError } from "../errors/ApiError";

const SORTABLE_FIELDS = ["id", "name", "registeredAt"];

// Locked to `Anchor` at compile time: adding a field to the model without
// adding a column here fails the build instead of silently shrinking the
// CSV export. See `csvColumnsFor` in ../utils/csv.
const CSV_COLUMNS = csvColumnsFor<Anchor>()([
  "id",
  "name",
  "registeredAt",
  "active",
]);

const SETTLEMENT_SORTABLE_FIELDS = [
  "id",
  "amount",
  "fee",
  "status",
  "createdAt",
];

// Must stay identical to the column list in ../routes/settlements.ts so the
// nested export matches the top-level one; both are locked to `Settlement`.
const SETTLEMENT_CSV_COLUMNS = csvColumnsFor<Settlement>()([
  "id",
  "anchor",
  "asset",
  "amount",
  "fee",
  "status",
  "createdAt",
  "cancelReason",
]);

const serializeSettlement = (s: Settlement) => ({
  ...s,
  amount: s.amount.toString(),
  fee: s.fee.toString(),
});

export function anchorRouter(
  service: AnchorService,
  settlements?: SettlementService,
): Router {
  const router = Router();

  // Register a new anchor.
  router.post("/", (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve().then(() => service.register(req.body ?? {}))
      .then(async (anchor) => { await service.flush(); res.status(201).json(anchor); })
      .catch(next);
  });

  // Register a batch of anchors atomically.
  //
  // With ?dryRun=true the batch runs through the identical validation but
  // nothing is persisted — a preflight check for onboarding UIs. The response
  // shape and status match a real call, plus a `dryRun` flag so the caller can
  // confirm no registration happened. `dryRun` is strictly parsed: only
  // "true"/"false" are accepted, so a typo can never silently perform a real
  // registration.
  router.post("/bulk", (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve().then(async () => {
      const dryRun = optionalBooleanFlag(req.query.dryRun, "dryRun");
      const anchors = service.registerBulk((req.body ?? {}).anchors, dryRun);
      await service.flush();
      res.status(201).json({ anchors, dryRun });
    }).catch(next);
  });

  // List anchors, optionally filtered via ?status=active|inactive and/or a
  // free-text ?q= search over id/name, sorted via ?sort=id|name|registeredAt
  // and ?order=asc|desc, and exported as CSV via ?format=csv. Without legacy
  // offset parameters, the endpoint uses the canonical id-ascending cursor.
  router.get("/", (req: Request, res: Response) => {
    const hasCustomSort = req.query.sort !== undefined || req.query.order !== undefined;
    const filtered = service.list({ status: req.query.status, q: req.query.q });
    const sorted = hasCustomSort
      ? applySort(filtered, { sort: req.query.sort, order: req.query.order }, SORTABLE_FIELDS)
      : [...filtered].sort((a, b) => a.id.localeCompare(b.id));

    if (req.query.format === "csv") {
      res.type("text/csv").send(toCsv(sorted, CSV_COLUMNS));
      return;
    }

    const useCursor = req.query.cursor !== undefined ||
      (!hasCustomSort && req.query.page === undefined);
    if (useCursor && hasCustomSort) {
      throw ApiError.badRequest("cursor pagination requires the canonical anchor order (id asc)");
    }

    if (useCursor) {
      const page = paginateByCursor(sorted, {
        cursor: req.query.cursor,
        pageSize: req.query.pageSize,
        direction: "asc",
        scope: `anchors:${String(req.query.status ?? "")}:\u0000${String(req.query.q ?? "")}`,
        keyOf: (anchor) => anchor.id,
      });
      res.json({ anchors: page.items, pagination: { pageSize: page.pageSize, nextCursor: page.nextCursor } });
      return;
    }

    const page = paginate(sorted, { page: req.query.page, pageSize: req.query.pageSize });
    res.json({ anchors: page.items, pagination: { ...page, items: undefined } });
  });

  // Read a single anchor by id.
  router.get("/:id", (req: Request, res: Response) => {
    res.json(service.get(req.params.id));
  });

  // Partially update an anchor's mutable fields (currently just `name`).
  router.patch("/:id", (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve().then(async () => {
      const anchor = service.update(req.params.id, req.body ?? {});
      await service.flush();
      res.json(anchor);
    }).catch(next);
  });

  // Deactivate an anchor.
  router.delete("/:id", (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve().then(async () => {
      const anchor = service.deregister(req.params.id);
      await service.flush();
      res.json(anchor);
    }).catch(next);
  });

  // Reactivate a previously deactivated anchor.
  router.post("/:id/reactivate", (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve().then(async () => {
      const anchor = service.reactivate(req.params.id);
      await service.flush();
      res.json(anchor);
    }).catch(next);
  });

  // List settlements for a specific anchor, scoped by its id.
  // Returns 404 if the anchor does not exist.
  // Supports ?sort=, ?order=, ?page=, ?pageSize=, and ?format=csv.
  router.get("/:id/settlements", (req: Request, res: Response) => {
    // Validate anchor existence — throws 404 if unknown.
    service.get(req.params.id);

    if (!settlements) {
      res.status(501).json({
        error: {
          code: "NOT_IMPLEMENTED",
          message: "settlements service unavailable",
        },
      });
      return;
    }

    const hasCustomSort = req.query.sort !== undefined || req.query.order !== undefined;
    const rawSettlements = settlements.list({ anchor: req.params.id });
    const sorted = hasCustomSort
      ? applySort(rawSettlements, { sort: req.query.sort, order: req.query.order }, SETTLEMENT_SORTABLE_FIELDS)
      : [...rawSettlements].sort((a, b) => b.id - a.id);

    // CSV export ignores pagination and returns every matching, sorted row.
    if (req.query.format === "csv") {
      const stringifiedSorted = sorted.map(serializeSettlement);
      res.type("text/csv").send(toCsv(stringifiedSorted, SETTLEMENT_CSV_COLUMNS));
      return;
    }

    const useCursor = req.query.cursor !== undefined ||
      (!hasCustomSort && req.query.page === undefined);
    if (useCursor && hasCustomSort) {
      throw ApiError.badRequest("cursor pagination requires the canonical settlement order (id desc)");
    }

    if (useCursor) {
      const page = paginateByCursor(sorted, {
        cursor: req.query.cursor,
        pageSize: req.query.pageSize,
        direction: "desc",
        scope: `anchor-settlements:${req.params.id}`,
        keyOf: (settlement) => String(settlement.id).padStart(20, "0"),
      });
      res.json({
        settlements: page.items.map(serializeSettlement),
        pagination: { pageSize: page.pageSize, nextCursor: page.nextCursor },
      });
      return;
    }

    const page = paginate(sorted, {
      page: req.query.page,
      pageSize: req.query.pageSize,
    });
    res.json({
      settlements: page.items.map(serializeSettlement),
      pagination: { ...page, items: undefined },
    });
  });

  return router;
}
