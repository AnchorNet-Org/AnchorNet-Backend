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

  /**
   * Partially updates an anchor's mutable display name. `id`, `registeredAt`
   * and `active` are managed elsewhere (registration and (re)activation) and
   * cannot be changed here. Throws 404 if unknown, or 400 if `name` is
   * missing or blank.
   */
  update(idInput: unknown, input: { name?: unknown }): Anchor {
    const anchor = this.get(idInput);
    if (input.name === undefined) {
      throw ApiError.badRequest('"name" must be provided to update an anchor');
    }
    const name = requireString(input.name, "name");
    return this.repo.upsert({ ...anchor, name });
  }

  /** Returns `true` if the anchor exists and is active. */
  isActive(id: string): boolean {
    return this.repo.get(id)?.active === true;
  }

  /**
   * Registers a batch of anchors atomically: every entry is validated (and
   * checked against both the existing registry and duplicate ids within the
   * same batch) before any of them are stored, so a single bad entry never
   * leaves a partial batch registered.
   */
  registerBulk(input: unknown): Anchor[] {
    if (!Array.isArray(input) || input.length === 0) {
      throw ApiError.badRequest('"anchors" must be a non-empty array');
    }

    const seen = new Set<string>();
    const parsed = input.map((entry, index) => {
      const record = (entry ?? {}) as { id?: unknown; name?: unknown };
      const id = requireString(record.id, `anchors[${index}].id`);
      const name =
        record.name === undefined
          ? id
          : requireString(record.name, `anchors[${index}].name`);

      if (seen.has(id)) {
        throw ApiError.conflict(`anchor "${id}" appears more than once in the batch`);
      }
      seen.add(id);

      if (this.repo.has(id)) {
        throw ApiError.conflict(`anchor "${id}" is already registered`);
      }

      return { id, name };
    });

    return parsed.map(({ id, name }) =>
      this.repo.upsert({
        id,
        name,
        registeredAt: new Date().toISOString(),
        active: true,
      }),
    );
  }
}
