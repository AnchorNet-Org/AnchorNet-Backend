/**
 * Lightweight request logging middleware.
 *
 * Logs method, path, status code and duration once each response finishes.
 * Stays quiet during tests to keep the Jest output clean.
 */

import { NextFunction, Request, Response } from "express";

export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (process.env.NODE_ENV === "test") {
    next();
    return;
  }

  const start = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - start;
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`);
  });
  next();
}
