/**
 * Liquidity service.
 *
 * Owns the business rules for recording anchor liquidity and exposing
 * aggregated pool views to the routing layer.
 */

import { LiquidityRepository } from "../repositories/liquidityRepository";
import { LiquidityEntry, Pool } from "../models/liquidity";
import { ApiError } from "../errors/ApiError";
import {
  normalizeAsset,
  requirePositiveNumber,
  requireString,
} from "../utils/validation";

export class LiquidityService {
  constructor(private readonly repo: LiquidityRepository) {}

  /**
   * Records `amount` of liquidity from `anchor` in `asset`. If the anchor
   * already has a balance for the asset, the amounts are accumulated.
   */
  addLiquidity(input: {
    anchor: unknown;
    asset: unknown;
    amount: unknown;
  }): LiquidityEntry {
    const anchor = requireString(input.anchor, "anchor");
    const asset = normalizeAsset(input.asset);
    const amount = requirePositiveNumber(input.amount, "amount");

    const existing = this.repo.get(anchor, asset);
    const total = (existing?.amount ?? 0) + amount;

    return this.repo.upsert({
      anchor,
      asset,
      amount: total,
      updatedAt: new Date().toISOString(),
    });
  }

  /** Returns the aggregated pools for every asset. */
  listPools(): Pool[] {
    return this.repo.pools().sort((a, b) => a.asset.localeCompare(b.asset));
  }

  /** Returns the aggregated pool for one asset, or 404 if none exists. */
  getPool(assetInput: unknown): Pool {
    const asset = normalizeAsset(assetInput);
    const pool = this.repo.pools().find((p) => p.asset === asset);
    if (!pool) {
      throw ApiError.notFound(`no liquidity pool for asset "${asset}"`);
    }
    return pool;
  }

  /** Returns all raw liquidity entries. */
  listEntries(): LiquidityEntry[] {
    return this.repo.all();
  }
}
