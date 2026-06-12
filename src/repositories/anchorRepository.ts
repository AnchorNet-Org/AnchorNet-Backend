/**
 * In-memory store for registered anchors, keyed by anchor id.
 */

import { Anchor } from "../models/anchor";

export class AnchorRepository {
  private readonly anchors = new Map<string, Anchor>();

  /** Returns the anchor with `id`, or `undefined`. */
  get(id: string): Anchor | undefined {
    return this.anchors.get(id);
  }

  /** Returns `true` if an anchor with `id` exists. */
  has(id: string): boolean {
    return this.anchors.has(id);
  }

  /** Inserts or replaces an anchor. */
  upsert(anchor: Anchor): Anchor {
    this.anchors.set(anchor.id, anchor);
    return anchor;
  }

  /** Removes an anchor, returning `true` if one existed. */
  remove(id: string): boolean {
    return this.anchors.delete(id);
  }

  /** Returns every anchor, sorted by id. */
  all(): Anchor[] {
    return [...this.anchors.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  /** Returns the number of stored anchors. */
  count(): number {
    return this.anchors.size;
  }
}
