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

  /**
   * Withdraws `amount` of liquidity previously contributed by `anchor` in
   * `asset`, mirroring the on-chain contract's `withdraw_liquidity`. Reduces
   * the anchor's balance and removes the entry once it reaches zero. Throws
   * 404 if the anchor holds no balance in the asset, or 400
   * (`INSUFFICIENT_LIQUIDITY`) if the withdrawal exceeds the balance.
   */
  withdrawLiquidity(input: {
    anchor: unknown;
    asset: unknown;
    amount: unknown;
  }): LiquidityEntry {
    const anchor = requireString(input.anchor, "anchor");
    const asset = normalizeAsset(input.asset);
    const amount = requirePositiveNumber(input.amount, "amount");

    const existing = this.repo.get(anchor, asset);
    if (!existing) {
      throw ApiError.notFound(
        `no liquidity balance for anchor "${anchor}" in ${asset}`,
      );
    }
    if (existing.amount < amount) {
      throw ApiError.badRequest(
        `insufficient balance for ${asset}: requested ${amount}, available ${existing.amount}`,
        "INSUFFICIENT_LIQUIDITY",
      );
    }

    const remaining = existing.amount - amount;
    const updatedAt = new Date().toISOString();

    if (remaining === 0) {
      this.repo.remove(anchor, asset);
      return { anchor, asset, amount: 0, updatedAt };
    }

    return this.repo.upsert({ anchor, asset, amount: remaining, updatedAt });
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
