/**
 * Routes for managing registered anchors.
 */

import { Router, Request, Response } from "express";
import { AnchorService } from "../services/anchorService";
import { applySort } from "../utils/sorting";

const SORTABLE_FIELDS = ["id", "name", "registeredAt"];

export function anchorRouter(service: AnchorService): Router {
  const router = Router();

  // Register a new anchor.
  router.post("/", (req: Request, res: Response) => {
    const anchor = service.register(req.body ?? {});
    res.status(201).json(anchor);
  });

  // List anchors, optionally filtered via ?status=active|inactive and sorted
  // via ?sort=id|name|registeredAt and ?order=asc|desc.
  router.get("/", (req: Request, res: Response) => {
    const anchors = applySort(
      service.list(req.query.status),
      { sort: req.query.sort, order: req.query.order },
      SORTABLE_FIELDS,
    );
    res.json({ anchors });
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
