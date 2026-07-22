/**
 * In-memory store for settlements with an auto-incrementing id.
 */

import { Settlement } from "../models/settlement";
import { InMemoryRepository } from "./inMemoryRepository";

export class SettlementRepository extends InMemoryRepository<number, Settlement> {
  /** Secondary index: anchor -> set of settlement ids */
  private readonly anchorIndex: Map<string, Set<number>> = new Map();
  /** Returns the id that will be assigned to the next created settlement. */
  peekNextId(): number {
    return this.peekId();
  }

  /** Stores a settlement under a freshly allocated id. */
  create(settlement: Omit<Settlement, "id">): Settlement {
    const id = this.generateId();
    const created: Settlement = { ...settlement, id };
    // Update anchor index
    const anchorSet = this.anchorIndex.get(created.anchor) ?? new Set();
    anchorSet.add(id);
    this.anchorIndex.set(created.anchor, anchorSet);
    return this.upsertByKey(id, created);
  }

  /** Replaces an existing settlement (e.g. after a status change). */
  save(settlement: Settlement): Settlement {
    // Ensure anchor index consistency (anchor is immutable)
    const existing = this.getByKey(settlement.id);
    if (existing && existing.anchor !== settlement.anchor) {
      // Anchor change not expected; reindex to maintain integrity
      const oldSet = this.anchorIndex.get(existing.anchor);
      if (oldSet) oldSet.delete(settlement.id);
      const newSet = this.anchorIndex.get(settlement.anchor) ?? new Set();
      newSet.add(settlement.id);
      this.anchorIndex.set(settlement.anchor, newSet);
    }
    return this.upsertByKey(settlement.id, settlement);

  }

  /** Returns the settlement with `id`, or `undefined`. */
  get(id: number): Settlement | undefined {
    return this.getByKey(id);
  }

  /** Returns every settlement, most recent first. */
  all(): Settlement[] {
    return this.listAll().sort((a, b) => b.id - a.id);
  }

  /** Returns settlements for a given anchor, most recent first. */
  byAnchor(anchor: string): Settlement[] {
    const idSet = this.anchorIndex.get(anchor);
    if (!idSet) return [];
    const settlements = this.getSettlementsByIds(idSet);
    // Ensure most recent first (sorted descending by id)
    return settlements.sort((a: Settlement, b: Settlement) => b.id - a.id);
  }

  /** Returns the number of stored settlements. */
  count(): number {
    return this.countAll();
  }
  /** Helper to fetch settlements by a collection of ids */
  private getSettlementsByIds(ids: Iterable<number>): Settlement[] {
    const result: Settlement[] = [];
    for (const id of ids) {
      const s = this.getByKey(id);
      if (s) result.push(s);
    }
    return result;
  }
}

