/**
 * AnchorNet API application factory.
 *
 * Builds and configures the Express app without binding to a port so that the
 * same instance can be reused by the HTTP server and by tests.
 */

import express, { Express, Request, Response } from "express";
import cors from "cors";

export function createApp(): Express {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", service: "anchornet-backend" });
  });

  app.get("/api/v1/info", (_req: Request, res: Response) => {
    res.json({
      name: "AnchorNet API",
      version: "0.1.0",
      description: "Liquidity coordination network for Stellar anchors",
    });
  });

  return app;
}
