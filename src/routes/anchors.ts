/**
 * Routes for managing registered anchors.
 */

import { Router, Request, Response } from "express";
import { AnchorService } from "../services/anchorService";

export function anchorRouter(service: AnchorService): Router {
  const router = Router();

  // Register a new anchor.
  router.post("/", (req: Request, res: Response) => {
    const anchor = service.register(req.body ?? {});
    res.status(201).json(anchor);
  });

  // List anchors, optionally filtered via ?status=active|inactive.
  router.get("/", (req: Request, res: Response) => {
    res.json({ anchors: service.list(req.query.status) });
  });

  // Read a single anchor by id.
  router.get("/:id", (req: Request, res: Response) => {
    res.json(service.get(req.params.id));
  });

  // Deactivate an anchor.
  router.delete("/:id", (req: Request, res: Response) => {
    res.json(service.deregister(req.params.id));
  });

  // Reactivate a previously deactivated anchor.
  router.post("/:id/reactivate", (req: Request, res: Response) => {
    res.json(service.reactivate(req.params.id));
  });

  return router;
}
