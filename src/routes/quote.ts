/**
 * Route for computing routing quotes.
 */

import { Router, Request, Response } from "express";
import { QuoteService } from "../services/quoteService";

export function quoteRouter(service: QuoteService): Router {
  const router = Router();

  // Compute a routing quote for an asset/amount pair.
  router.post("/", (req: Request, res: Response) => {
    res.json(service.quote(req.body ?? {}));
  });

  return router;
}
