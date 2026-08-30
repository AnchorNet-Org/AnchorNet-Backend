/**
 * Durable repository facades.
 *
 * The domain services currently expose synchronous methods. These adapters
 * preserve that contract for callers by maintaining a hydrated, process-local
 * read cache while serializing every mutation to PostgreSQL. The HTTP startup
 * path hydrates the cache before binding, and mutation routes can flush the
 * queue before returning when a durable acknowledgement is required.
 */

import { Anchor } from "../models/anchor";
import { LiquidityEntry } from "../models/liquidity";
import { Settlement } from "../models/settlement";
import { PostgresPersistence, PersistenceSnapshot } from "../persistence/postgres";
import { AnchorRepository } from "./anchorRepository";
import { LiquidityRepository } from "./liquidityRepository";
import { SettlementRepository } from "./settlementRepository";

export class PersistentAnchorRepository extends AnchorRepository {
  constructor(
    private readonly database: PostgresPersistence,
    snapshot: PersistenceSnapshot,
  ) {
    super();
    for (const anchor of snapshot.anchors) super.upsert(anchor);
  }

  override upsert(anchor: Anchor): Anchor {
    const result = super.upsert(anchor);
    void this.database.upsertAnchor(result);
    return result;
  }

  override remove(id: string): boolean {
    const removed = super.remove(id);
    if (removed) void this.database.removeAnchor(id);
    return removed;
  }

  flush(): Promise<void> {
    return this.database.flush();
  }
}

export class PersistentLiquidityRepository extends LiquidityRepository {
  constructor(
    private readonly database: PostgresPersistence,
    snapshot: PersistenceSnapshot,
  ) {
    super();
    for (const entry of snapshot.liquidity) super.upsert(entry);
  }

  override upsert(entry: LiquidityEntry): LiquidityEntry {
    const result = super.upsert(entry);
    void this.database.upsertLiquidity(result);
    return result;
  }

  override remove(anchor: string, asset: string): boolean {
    const removed = super.remove(anchor, asset);
    if (removed) void this.database.removeLiquidity(anchor, asset);
    return removed;
  }

  flush(): Promise<void> {
    return this.database.flush();
  }
}

export class PersistentSettlementRepository extends SettlementRepository {
  constructor(
    private readonly database: PostgresPersistence,
    snapshot: PersistenceSnapshot,
  ) {
    super();
    for (const settlement of snapshot.settlements) super.save(settlement);
  }

  override create(settlement: Omit<Settlement, "id">): Settlement {
    const result = super.create(settlement);
    void this.database.insertSettlement(result);
    return result;
  }

  override save(settlement: Settlement): Settlement {
    const result = super.save(settlement);
    void this.database.insertSettlement(result);
    return result;
  }

  override remove(id: number): boolean {
    const removed = super.remove(id);
    if (removed) void this.database.removeSettlement(id);
    return removed;
  }

  /** Adds a row returned by a database transaction without writing it again. */
  hydrate(settlement: Settlement): Settlement {
    return super.save(settlement);
  }

  flush(): Promise<void> {
    return this.database.flush();
  }
}
