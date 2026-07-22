/**
 * AnchorNet API application factory.
 *
 * Builds and configures the Express app without binding to a port so that the
 * same instance can be reused by the HTTP server and by tests.
 */

import express, { Express, Request, Response } from "express";
import cors from "cors";
import compression from "compression";

import { LiquidityRepository } from "./repositories/liquidityRepository";
import { AnchorRepository } from "./repositories/anchorRepository";
import { SettlementRepository } from "./repositories/settlementRepository";
import { LiquidityService } from "./services/liquidityService";
import { QuoteService } from "./services/quoteService";
import { AnchorService } from "./services/anchorService";
import { SettlementService } from "./services/settlementService";
import { liquidityRouter } from "./routes/liquidity";
import { quoteRouter } from "./routes/quote";
import { anchorRouter } from "./routes/anchors";
import { settlementRouter } from "./routes/settlements";
import { metricsRouter } from "./routes/metrics";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { requestLogger } from "./middleware/requestLogger";
import { requestId } from "./middleware/requestId";
import { apiKeyAuth } from "./middleware/apiKeyAuth";
import { rateLimiter } from "./middleware/rateLimiter";
import { securityHeaders } from "./middleware/securityHeaders";
import { idempotency } from "./middleware/idempotency";
import { maintenanceMode } from "./middleware/maintenanceMode";
import { createAuditLog } from "./middleware/auditLog";
import { loadConfig, Config } from "./config";
import { buildOpenApiSpec } from "./openapi";
import { isReady } from "./utils/readiness";

export function createApp(): Express {
  const app = express();
  const config = loadConfig();

  app.use(cors(config.corsOrigins ? { origin: config.corsOrigins } : undefined));
  app.use(compression());
  app.use(securityHeaders);
  app.use(express.json({ limit: config.bodyLimit }));
  app.use(requestId);
  app.use(requestLogger);
  app.use(maintenanceMode(config.maintenanceMode));
  app.use(apiKeyAuth(config.apiKey));
  app.use(rateLimiter({ max: config.rateLimitMax, windowMs: config.rateLimitWindowMs }, config.apiKey));
  app.use(idempotency({ ttlMs: config.idempotencyTtlMs }));

  const audit = createAuditLog();
  app.use(audit.middleware);

  const repo = new LiquidityRepository();
  const anchors = new AnchorService(new AnchorRepository());
  const quotes = new QuoteService(repo, config.feeBps);
  const settlements = new SettlementService(
    new SettlementRepository(),
    repo,
    anchors,
    config.feeBps,
  );
  const liquidity = new LiquidityService(repo, settlements);

  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", service: "anchornet-backend" });
  });

  app.get("/health/live", (_req: Request, res: Response) => {
    res.json({ status: "ok" });
  });

  app.get("/health/ready", (_req: Request, res: Response) => {
    if (!isReady()) {
      res.status(503).json({ status: "not_ready" });
      return;
    }
    res.json({ status: "ready" });
  });

  app.get("/api/v1/info", (_req: Request, res: Response) => {
    res.json({
      name: "AnchorNet API",
      version: "0.9.0",
      description: "Liquidity coordination network for Stellar anchors",
    });
  });

  app.get("/api/v1/openapi.json", (_req: Request, res: Response) => {
    res.json(buildOpenApiSpec());
  });

  app.get("/api/v1/audit", (_req: Request, res: Response) => {
    res.json({ entries: audit.entries() });
  });

  app.use("/api/v1/liquidity", liquidityRouter(liquidity));
  // The quote endpoint recomputes routing on every call, so it gets a
  // stricter rate limit than the general default in addition to it.
  app.use(
    "/api/v1/quote",
    rateLimiter({ max: 10, windowMs: 60_000 }, config.apiKey),
  );
  app.use("/api/v1/quote", quoteRouter(quotes));
  app.use("/api/v1/anchors", anchorRouter(anchors, settlements));
  app.use("/api/v1/settlements", settlementRouter(settlements));
  app.use(
    "/api/v1/metrics",
    metricsRouter({
      liquidity,
      anchors,
      settlements,
      snapshotIntervalMs: config.metricsSnapshotIntervalMs,
    }),
  );

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

/**
 * Expose the validated configuration for external consumers.
 */
export function getConfig(): Config {
  return loadConfig();
}
