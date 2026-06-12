/**
 * AnchorNet API application factory.
 *
 * Builds and configures the Express app without binding to a port so that the
 * same instance can be reused by the HTTP server and by tests.
 */

import express, { Express, Request, Response } from "express";
import cors from "cors";

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
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { requestLogger } from "./middleware/requestLogger";
import { apiKeyAuth } from "./middleware/apiKeyAuth";
import { loadConfig } from "./config";

export function createApp(): Express {
  const app = express();
  const config = loadConfig();

  app.use(cors());
  app.use(express.json());
  app.use(requestLogger);
  app.use(apiKeyAuth(config.apiKey));

  // Shared in-memory state and services for this process.
  const repo = new LiquidityRepository();
  const liquidity = new LiquidityService(repo);
  const quotes = new QuoteService(repo, config.feeBps);
  const anchors = new AnchorService(new AnchorRepository());
  const settlements = new SettlementService(
    new SettlementRepository(),
    repo,
    anchors,
    config.feeBps,
  );

  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", service: "anchornet-backend" });
  });

  app.get("/api/v1/info", (_req: Request, res: Response) => {
    res.json({
      name: "AnchorNet API",
      version: "0.2.0",
      description: "Liquidity coordination network for Stellar anchors",
    });
  });

  app.use("/api/v1/liquidity", liquidityRouter(liquidity));
  app.use("/api/v1/quote", quoteRouter(quotes));
  app.use("/api/v1/anchors", anchorRouter(anchors));
  app.use("/api/v1/settlements", settlementRouter(settlements));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
