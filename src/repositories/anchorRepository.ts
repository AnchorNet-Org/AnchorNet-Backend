/**
 * In-memory store for registered anchors, keyed by anchor id.
 */

import { Anchor } from "../models/anchor";
import { InMemoryRepository } from "./inMemoryRepository";

export class AnchorRepository extends InMemoryRepository<string, Anchor> {
  /** Returns the anchor with `id`, or `undefined`. */
  get(id: string): Anchor | undefined {
    return this.getByKey(id);
  }

  /** Returns `true` if an anchor with `id` exists. */
  has(id: string): boolean {
    return this.hasByKey(id);
  }

  /** Inserts or replaces an anchor. */
  upsert(anchor: Anchor): Anchor {
    return this.upsertByKey(anchor.id, anchor);
  }

  /** Removes an anchor, returning `true` if one existed. */
  remove(id: string): boolean {
    return this.removeByKey(id);
  }

  /** Returns every anchor, sorted by id. */
  all(): Anchor[] {
    return this.listAll().sort((a, b) => a.id.localeCompare(b.id));
  }

  /** Returns the number of stored anchors. */
  count(): number {
    return this.countAll();
  }
}
