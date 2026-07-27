/**
 * Liquidity service.
 *
 * Owns the business rules for recording anchor liquidity and exposing
 * aggregated pool views to the routing layer.
 */

import { LiquidityRepository } from "../repositories/liquidityRepository";
import { LiquidityEntry, Pool } from "../models/liquidity";
import { ApiError } from "../errors/ApiError";
import { SettlementService } from "./settlementService";
import {
  normalizeAsset,
  requirePositiveNumber,
  requireString,
} from "../utils/validation";

export class LiquidityService {
  constructor(
    private readonly repo: LiquidityRepository,
    private readonly settlementService?: SettlementService,
  ) {}

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

    // Ensure withdrawal does not exceed the liquidity available for settlements
    if (this.settlementService) {
      const available = this.settlementService.available(asset);
      if (amount > available) {
        throw ApiError.badRequest(
          `withdrawal would reduce available liquidity for ${asset} below zero: requested ${amount}, available ${available}`,
          "INSUFFICIENT_LIQUIDITY_RESERVED",
        );
      }
    }

    const remaining = existing.amount - amount;
    const updatedAt = new Date().toISOString();

    if (remaining === 0) {
      this.repo.remove(anchor, asset);
      return { anchor, asset, amount: 0, updatedAt };
    }

    return this.repo.upsert({ anchor, asset, amount: remaining, updatedAt });
  }

  /**
   * Transfers `amount` of liquidity in `asset` from one anchor to another,
   * atomically, as a single logical operation.
   *
   * This replaces the withdraw-then-add two-step, which was not atomic and
   * briefly reduced the pool total between the two calls. All validation runs
   * before any mutation, so a rejected transfer never changes either anchor's
   * balance. Throws 404 if the source anchor holds no balance in the asset,
   * or 400 (`INSUFFICIENT_LIQUIDITY`) if the transfer exceeds the source
   * balance, mirroring {@link withdrawLiquidity}. Self-transfers are rejected
   * with 400.
   *
   * No reserved-liquidity check is needed: the source decrement always equals
   * the destination increment, so the asset's pool total — and therefore the
   * liquidity available for settlements — is unchanged by construction.
   *
   * Returns the resulting entries for both anchors. When the full source
   * balance is transferred, the source entry is removed and returned with
   * `amount: 0`, mirroring {@link withdrawLiquidity}.
   */
  transferLiquidity(input: {
    from: unknown;
    to: unknown;
    asset: unknown;
    amount: unknown;
  }): { from: LiquidityEntry; to: LiquidityEntry } {
    const from = requireString(input.from, "from");
    const to = requireString(input.to, "to");
    const asset = normalizeAsset(input.asset);
    const amount = requirePositiveNumber(input.amount, "amount");

    if (from === to) {
      throw ApiError.badRequest(
        `"from" and "to" must be different anchors`,
        "SAME_ANCHOR",
      );
    }

    const source = this.repo.get(from, asset);
    if (!source) {
      throw ApiError.notFound(
        `no liquidity balance for anchor "${from}" in ${asset}`,
      );
    }
    if (source.amount < amount) {
      throw ApiError.badRequest(
        `insufficient balance for ${asset}: requested ${amount}, available ${source.amount}`,
        "INSUFFICIENT_LIQUIDITY",
      );
    }

    // Every check that can throw is above this line, so the two mutations
    // below are atomic in effect: the transfer is never partially applied.
    const updatedAt = new Date().toISOString();
    const fromRemaining = source.amount - amount;
    const destination = this.repo.get(to, asset);
    const toTotal = (destination?.amount ?? 0) + amount;

    let fromEntry: LiquidityEntry;
    if (fromRemaining === 0) {
      this.repo.remove(from, asset);
      fromEntry = { anchor: from, asset, amount: 0, updatedAt };
    } else {
      fromEntry = this.repo.upsert({
        anchor: from,
        asset,
        amount: fromRemaining,
        updatedAt,
      });
    }
    const toEntry = this.repo.upsert({
      anchor: to,
      asset,
      amount: toTotal,
      updatedAt,
    });

    return { from: fromEntry, to: toEntry };
  }

  /**
   * Removes an anchor's entire liquidity entry for an asset, regardless of
   * its current balance. Returns the removed entry, or 404 if none exists.
   */
  removeEntry(anchorInput: unknown, assetInput: unknown): LiquidityEntry {
    const anchor = requireString(anchorInput, "anchor");
    const asset = normalizeAsset(assetInput);
    const existing = this.repo.get(anchor, asset);

    if (!existing) {
      throw ApiError.notFound(
        `no liquidity balance for anchor "${anchor}" in ${asset}`,
      );
    }

    this.repo.remove(anchor, asset);
    return existing;
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

  /** Returns all raw liquidity entries for a given anchor. */
  listByAnchor(anchorInput: unknown): LiquidityEntry[] {
    const anchor = requireString(anchorInput, "anchor");
    return this.repo.byAnchor(anchor);
  }
}
