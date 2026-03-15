/**
 * AnchorNet API – entry point.
 * Provides routing, settlement, and liquidity indexer endpoints.
 */

import express, { Request, Response } from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT ?? 3001;

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

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`AnchorNet API listening on http://localhost:${PORT}`);
  });
}

export default app;
