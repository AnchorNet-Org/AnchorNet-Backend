/**
 * In-memory store for registered anchors, keyed by anchor id.
 */

import { Anchor } from "../models/anchor";
import { InMemoryRepository } from "./inMemoryRepository";

export class AnchorRepository extends InMemoryRepository<string, Anchor> {
  /** Set of ids for active anchors */
  private activeIds: Set<string> = new Set();
  /** Set of ids for inactive anchors */
  private inactiveIds: Set<string> = new Set();
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
    // Update active/inactive index sets based on the anchor's status
    const wasPresent = this.hasByKey(anchor.id);
    if (wasPresent) {
      const existing = this.getByKey(anchor.id);
      if (existing) {
        if (existing.active) this.activeIds.delete(anchor.id);
        else this.inactiveIds.delete(anchor.id);
      }
    }
    const result = this.upsertByKey(anchor.id, anchor);
    if (anchor.active) this.activeIds.add(anchor.id);
    else this.inactiveIds.add(anchor.id);
    return result;
  }

  /** Removes an anchor, returning `true` if one existed. */
  remove(id: string): boolean {
    const existed = this.removeByKey(id);
    if (existed) {
      this.activeIds.delete(id);
      this.inactiveIds.delete(id);
    }
    return existed;
  }

  /** Returns every anchor, sorted by id. */
  all(): Anchor[] {
    return this.listAll().sort((a, b) => a.id.localeCompare(b.id));
  }

  /** Returns the number of stored anchors. */
  count(): number {
    return this.countAll();
  }

  /** O(1) count of active anchors */
  countActive(): number {
    return this.activeIds.size;
  }

  /** O(1) count of inactive anchors */
  countInactive(): number {
    return this.inactiveIds.size;
  }
}
