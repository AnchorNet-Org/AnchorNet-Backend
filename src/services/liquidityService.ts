/**
 * Liquidity service.
 *
 * Owns the business rules for recording anchor liquidity and exposing
 * aggregated pool views to the routing layer.
 */

import { LiquidityRepository } from "../repositories/liquidityRepository";
import { LiquidityEntry, Pool, WithdrawalRecord } from "../models/liquidity";
import { ApiError } from "../errors/ApiError";
import { SettlementService } from "./settlementService";
import { BoundedHistory } from "../utils/history";
import {
  normalizeAsset,
  requirePositiveNumber,
  requireString,
} from "../utils/validation";

/**
 * Maximum number of withdrawal records retained in memory. Mirrors the bounded
 * rolling-window pattern used by `routes/metrics.ts`, keeping an audit trail of
 * recent withdrawals without unbounded memory growth.
 */
const MAX_WITHDRAWAL_HISTORY = 100;

export class LiquidityService {
  private readonly withdrawalHistory = new BoundedHistory<WithdrawalRecord>(
    MAX_WITHDRAWAL_HISTORY,
  );

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

    // Record the successful withdrawal for auditability BEFORE mutating state.
    // This runs only after every guard above has passed, so a failed withdrawal
    // (unknown balance, insufficient funds, or reserved-liquidity breach) leaves
    // no record. `remaining` is computed once and used by both branches below, so
    // the recorded `remainingBalance` is correct whether the entry survives or is
    // removed once it reaches zero.
    this.withdrawalHistory.push({
      anchor,
      asset,
      amount,
      remainingBalance: remaining,
      timestamp: updatedAt,
    });

    if (remaining === 0) {
      this.repo.remove(anchor, asset);
      return { anchor, asset, amount: 0, updatedAt };
    }

    return this.repo.upsert({ anchor, asset, amount: remaining, updatedAt });
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

  /**
   * Returns the in-memory audit trail of successful withdrawals, oldest first.
   *
   * Each record captures the anchor, asset, amount withdrawn, the resulting
   * balance, and an ISO-8601 timestamp. Bounded to the most recent
   * {@link MAX_WITHDRAWAL_HISTORY} entries; older entries are evicted
   * automatically. This survives the removal of a `LiquidityEntry` once its
   * balance reaches zero, where the mutating-request audit-log middleware does
   * not (it records only method/path/status, not amounts).
   */
  listWithdrawals(): WithdrawalRecord[] {
    return this.withdrawalHistory.all();
  }
}
