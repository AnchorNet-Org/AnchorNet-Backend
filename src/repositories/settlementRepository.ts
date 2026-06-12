/**
 * In-memory store for settlements with an auto-incrementing id.
 */

import { Settlement } from "../models/settlement";

export class SettlementRepository {
  private readonly settlements = new Map<number, Settlement>();
  private nextId = 1;

  /** Returns the id that will be assigned to the next created settlement. */
  peekNextId(): number {
    return this.nextId;
  }

  /** Stores a settlement under a freshly allocated id. */
  create(settlement: Omit<Settlement, "id">): Settlement {
    const created: Settlement = { ...settlement, id: this.nextId };
    this.settlements.set(this.nextId, created);
    this.nextId += 1;
    return created;
  }

  /** Replaces an existing settlement (e.g. after a status change). */
  save(settlement: Settlement): Settlement {
    this.settlements.set(settlement.id, settlement);
    return settlement;
  }

  /** Returns the settlement with `id`, or `undefined`. */
  get(id: number): Settlement | undefined {
    return this.settlements.get(id);
  }

  /** Returns every settlement, most recent first. */
  all(): Settlement[] {
    return [...this.settlements.values()].sort((a, b) => b.id - a.id);
  }

  /** Returns settlements for a given anchor, most recent first. */
  byAnchor(anchor: string): Settlement[] {
    return this.all().filter((s) => s.anchor === anchor);
  }

  /** Returns the number of stored settlements. */
  count(): number {
    return this.settlements.size;
  }
}
