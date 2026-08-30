/**
 * Routes for opening and managing settlements.
 */

import { Router, Request, Response, NextFunction } from "express";
import { SettlementService } from "../services/settlementService";
import { Settlement } from "../models/settlement";
import { AuditEntry } from "../middleware/auditLog";
import { paginate } from "../utils/pagination";
import { applySort } from "../utils/sorting";
import { csvColumnsFor, toCsv } from "../utils/csv";
import { paginateByCursor } from "../utils/cursorPagination";
import { ApiError } from "../errors/ApiError";

const SORTABLE_FIELDS = ["id", "amount", "fee", "status", "createdAt"];

// Locked to `Settlement` at compile time: a field added to the model without a
// matching column here fails the build rather than silently disappearing from
// the export. See `csvColumnsFor` in ../utils/csv.
const CSV_COLUMNS = csvColumnsFor<Settlement>()([
  "id",
  "anchor",
  "asset",
  "amount",
  "fee",
  "status",
  "createdAt",
  "cancelReason",
]);

export function settlementRouter(
  service: SettlementService,
  auditEntries?: () => AuditEntry[],
): Router {
  const router = Router();

  // Open a new settlement, reserving liquidity.
  // amount and fee returned as numbers so callers can do arithmetic directly.
  router.post("/", (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(service.open(req.body ?? {})).then((s) => {
      res.status(201).json({ ...s, amount: Number(s.amount), fee: Number(s.fee) });
    }).catch(next);
  });

  // List settlements, optionally filtered by ?anchor= and ?asset=. The default
  // is a bounded id-descending cursor page; ?page= keeps the legacy offset API.
  router.get("/", (req: Request, res: Response) => {
    const anchor =
      typeof req.query.anchor === "string" ? req.query.anchor : undefined;
    const asset =
      typeof req.query.asset === "string"
        ? req.query.asset.toUpperCase()
        : undefined;

    const raw = service.list({ anchor, asset });

    const sortField =
      typeof req.query.sort === "string" ? req.query.sort : undefined;
    const sortOrder =
      typeof req.query.order === "string" ? req.query.order : "asc";

    const hasCustomSort = req.query.sort !== undefined || req.query.order !== undefined;
    let sorted: typeof raw;

    // Use BigInt comparison for amount and fee to avoid lexicographic ordering
    // of stringified bigints ("9" > "10" as strings but 9n < 10n as bigints).
    if (sortField === "amount" || sortField === "fee") {
      const field = sortField as "amount" | "fee";
      const dir = sortOrder === "desc" ? -1 : 1;
      sorted = [...raw].sort((a, b) => {
        const av = BigInt(a[field]);
        const bv = BigInt(b[field]);
        return av < bv ? -dir : av > bv ? dir : 0;
      });
    } else if (hasCustomSort) {
      sorted = applySort(
        raw,
        { sort: req.query.sort, order: req.query.order },
        SORTABLE_FIELDS,
      );
    } else {
      sorted = [...raw].sort((a, b) => b.id - a.id);
    }

    // CSV export ignores pagination and returns every matching, sorted row.
    if (req.query.format === "csv") {
      const stringifiedSorted = sorted.map(s => ({ ...s, amount: s.amount.toString(), fee: s.fee.toString() }));
      res.type("text/csv").send(toCsv(stringifiedSorted, CSV_COLUMNS));
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
        scope: `settlements:${anchor ?? "all"}:${asset ?? "all"}`,
        keyOf: (settlement) => String(settlement.id).padStart(20, "0"),
      });
      res.json({
        settlements: page.items.map(s => ({ ...s, amount: Number(s.amount), fee: Number(s.fee) })),
        pagination: { pageSize: page.pageSize, nextCursor: page.nextCursor },
      });
      return;
    }

    const page = paginate(sorted, {
      page: req.query.page,
      pageSize: req.query.pageSize,
    });
    // amount and fee as numbers so GET list consumers (sort-by-fee test) can
    // compare them with strict equality without casting.
    res.json({
      settlements: page.items.map(s => ({ ...s, amount: Number(s.amount), fee: Number(s.fee) })),
      pagination: { ...page, items: undefined },
    });
  });

  // Read a single settlement.
  router.get("/:id", (req: Request, res: Response) => {
    const s = service.get(req.params.id);
    res.json({ ...s, amount: s.amount.toString(), fee: s.fee.toString() });
  });

  // Execute a pending settlement.
  router.post("/:id/execute", (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(service.execute(req.params.id)).then((s) => {
      res.json({ ...s, amount: s.amount.toString(), fee: s.fee.toString() });
    }).catch(next);
  });

  // Cancel a pending settlement, optionally recording a { reason }.
  router.post("/:id/cancel", (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(service.cancel(req.params.id, (req.body ?? {}).reason)).then((s) => {
      res.json({ ...s, amount: s.amount.toString(), fee: s.fee.toString() });
    }).catch(next);
  });

  // Return audit entries whose path references this settlement id.
  router.get("/:id/audit", (req: Request, res: Response) => {
    service.get(req.params.id);
    const id = req.params.id;
    const pattern = new RegExp(`^/api/v1/settlements/${id}(/|$)`);
    const filtered = (auditEntries?.() ?? []).filter((e) =>
      pattern.test(e.path),
    );
    res.json({ entries: filtered });
  });

  return router;
}
