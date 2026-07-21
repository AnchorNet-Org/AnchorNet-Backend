/**
 * In-memory store for settlements with an auto-incrementing id.
 */

import { Settlement } from "../models/settlement";
import { InMemoryRepository } from "./inMemoryRepository";

export class SettlementRepository extends InMemoryRepository<number, Settlement> {
  /** Returns the id that will be assigned to the next created settlement. */
  peekNextId(): number {
    return this.peekId();
  }

  /** Stores a settlement under a freshly allocated id. */
  create(settlement: Omit<Settlement, "id">): Settlement {
    const id = this.generateId();
    const created: Settlement = { ...settlement, id };
    return this.upsertByKey(id, created);
  }

  /** Replaces an existing settlement (e.g. after a status change). */
  save(settlement: Settlement): Settlement {
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
    return this.all().filter((s) => s.anchor === anchor);
  }

  /** Returns the number of stored settlements. */
  count(): number {
    return this.countAll();
  }
}
