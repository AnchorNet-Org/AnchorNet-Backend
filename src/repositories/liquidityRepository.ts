/**
 * In-memory store for liquidity entries.
 *
 * Entries are keyed by `${anchor}:${asset}` so each anchor holds at most one
 * balance per asset. This mirrors the on-chain contract's per-provider balance
 * and is swappable for a persistent indexer-backed store later.
 */

import { LiquidityEntry, Pool } from "../models/liquidity";

export class LiquidityRepository {
  private readonly entries = new Map<string, LiquidityEntry>();

  private static key(anchor: string, asset: string): string {
    return `${anchor}:${asset}`;
  }

  /** Returns the entry for an anchor/asset pair, or `undefined`. */
  get(anchor: string, asset: string): LiquidityEntry | undefined {
    return this.entries.get(LiquidityRepository.key(anchor, asset));
  }

  /** Inserts or replaces an entry. */
  upsert(entry: LiquidityEntry): LiquidityEntry {
    this.entries.set(LiquidityRepository.key(entry.anchor, entry.asset), entry);
    return entry;
  }

  /** Removes an entry, returning `true` if one existed. */
  remove(anchor: string, asset: string): boolean {
    return this.entries.delete(LiquidityRepository.key(anchor, asset));
  }

  /** Returns all entries for a given asset. */
  byAsset(asset: string): LiquidityEntry[] {
    return [...this.entries.values()].filter((e) => e.asset === asset);
  }

  /** Returns every stored entry. */
  all(): LiquidityEntry[] {
    return [...this.entries.values()];
  }

  /** Aggregates all entries into one {@link Pool} per asset. */
  pools(): Pool[] {
    const totals = new Map<string, Pool>();
    for (const entry of this.entries.values()) {
      const pool = totals.get(entry.asset) ?? {
        asset: entry.asset,
        total: 0,
        anchors: 0,
      };
      pool.total += entry.amount;
      pool.anchors += 1;
      totals.set(entry.asset, pool);
    }
    return [...totals.values()];
  }

  /** Removes every entry. Primarily used by tests. */
  clear(): void {
    this.entries.clear();
  }
}
