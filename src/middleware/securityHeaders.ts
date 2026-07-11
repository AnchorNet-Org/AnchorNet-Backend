/**
 * Hand-rolled security headers middleware.
 *
 * Sets a conservative set of defensive HTTP response headers: blocks MIME
 * sniffing, disallows framing, disables the legacy XSS auditor (superseded by
 * a proper CSP, but harmless to force off), limits referrer leakage, and
 * turns off cross-origin DNS prefetching. This is a small, dependency-free
 * stand-in for the subset of `helmet` this API needs.
 */

import { NextFunction, Request, Response } from "express";

export function securityHeaders(
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "0");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-DNS-Prefetch-Control", "off");
  next();
}
