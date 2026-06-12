/**
 * Assigns a request id to every request for tracing.
 *
 * Honors an inbound `x-request-id` header when present, otherwise generates a
 * UUID. The id is echoed back on the `x-request-id` response header.
 */

import { randomUUID } from "node:crypto";
import { NextFunction, Request, Response } from "express";

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header("x-request-id");
  const id = incoming && incoming.trim() !== "" ? incoming : randomUUID();
  res.setHeader("x-request-id", id);
  next();
}
