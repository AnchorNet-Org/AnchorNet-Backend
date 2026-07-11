/**
 * Anchor service.
 *
 * Owns the rules for registering and managing liquidity-providing anchors.
 */

import { AnchorRepository } from "../repositories/anchorRepository";
import { Anchor } from "../models/anchor";
import { ApiError } from "../errors/ApiError";
import { requireString } from "../utils/validation";

export class AnchorService {
  constructor(private readonly repo: AnchorRepository) {}

  /** Registers a new anchor. Fails with 409 if the id already exists. */
  register(input: { id: unknown; name?: unknown }): Anchor {
    const id = requireString(input.id, "id");
    const name =
      input.name === undefined ? id : requireString(input.name, "name");

    if (this.repo.has(id)) {
      throw ApiError.conflict(`anchor "${id}" is already registered`);
    }

    return this.repo.upsert({
      id,
      name,
      registeredAt: new Date().toISOString(),
      active: true,
    });
  }

  /**
   * Returns anchors, optionally filtered by active status. `statusInput` must
   * be `"active"`, `"inactive"`, or `undefined` (no filter); anything else is
   * a 400.
   */
  list(statusInput?: unknown): Anchor[] {
    if (statusInput === undefined) {
      return this.repo.all();
    }

    const status = requireString(statusInput, "status");
    if (status !== "active" && status !== "inactive") {
      throw ApiError.badRequest('"status" must be "active" or "inactive"');
    }

    const active = status === "active";
    return this.repo.all().filter((anchor) => anchor.active === active);
  }

  /** Returns one anchor or 404. */
  get(idInput: unknown): Anchor {
    const id = requireString(idInput, "id");
    const anchor = this.repo.get(id);
    if (!anchor) {
      throw ApiError.notFound(`anchor "${id}" not found`);
    }
    return anchor;
  }

  /** Deactivates an anchor. Returns the updated record, or 404 if unknown. */
  deregister(idInput: unknown): Anchor {
    const anchor = this.get(idInput);
    return this.repo.upsert({ ...anchor, active: false });
  }

  /**
   * Reactivates a previously deactivated anchor. Returns the updated record,
   * or 404 if unknown. Reactivating an already-active anchor is a no-op.
   */
  reactivate(idInput: unknown): Anchor {
    const anchor = this.get(idInput);
    return this.repo.upsert({ ...anchor, active: true });
  }

  /** Returns `true` if the anchor exists and is active. */
  isActive(id: string): boolean {
    return this.repo.get(id)?.active === true;
  }
}
