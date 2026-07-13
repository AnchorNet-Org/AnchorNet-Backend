/**
 * In-memory audit log of mutating requests.
 *
 * Records method/path/status/request-id/timestamp for every
 * POST/PUT/PATCH/DELETE request once its response finishes, in a bounded
 * rolling buffer, so operators can see recent write activity without an
 * external logging pipeline.
 */

import { NextFunction, Request, Response } from "express";
import { BoundedHistory } from "../utils/history";

export interface AuditEntry {
  method: string;
  path: string;
  status: number;
  requestId?: string;
  timestamp: string;
}

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const DEFAULT_LIMIT = 200;

export function createAuditLog(
  limit: number = DEFAULT_LIMIT,
): {
  middleware: (req: Request, res: Response, next: NextFunction) => void;
  entries: () => AuditEntry[];
} {
  const history = new BoundedHistory<AuditEntry>(limit);

  return {
    middleware: (req, res, next) => {
      if (!MUTATING_METHODS.has(req.method)) {
        next();
        return;
      }

      // Snapshot method/path now: Express mutates `req.url` (and so
      // `req.path`) while dispatching through mounted sub-routers, and by the
      // time the `finish` event fires that mutation may not have been
      // unwound, so reading them lazily below would capture the wrong value.
      const method = req.method;
      const path = req.originalUrl.split("?")[0];

      res.on("finish", () => {
        history.push({
          method,
          path,
          status: res.statusCode,
          requestId: res.getHeader("x-request-id") as string | undefined,
          timestamp: new Date().toISOString(),
        });
      });

      next();
    },
    entries: () => history.all(),
  };
}
