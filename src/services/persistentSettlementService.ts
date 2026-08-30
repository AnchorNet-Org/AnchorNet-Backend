/**
 * PostgreSQL settlement operations.
 *
 * Reads and validation are delegated to the existing synchronous service so
 * response semantics stay identical. Mutating settlement operations cross the
 * database boundary and therefore use the transaction methods on
 * PostgresPersistence. The routers accept either synchronous or Promise
 * results, which keeps the in-memory test service unchanged.
 */

import { ApiError } from "../errors/ApiError";
import { Settlement } from "../models/settlement";
import { PostgresPersistence } from "../persistence/postgres";
import { PersistentSettlementRepository } from "../repositories/persistentRepositories";
import { AnchorService } from "./anchorService";
import { SettlementService } from "./settlementService";
import {
  normalizeAsset,
  requireBigInt,
  requirePositiveInteger,
  requireString,
  requireStringMaxLength,
} from "../utils/validation";

export type MaybePromise<T> = T | Promise<T>;

export interface SettlementServiceLike {
  open(input: { anchor: unknown; asset: unknown; amount: unknown }): MaybePromise<Settlement>;
  execute(id: unknown): MaybePromise<Settlement>;
  cancel(id: unknown, reason?: unknown): MaybePromise<Settlement>;
  get(id: unknown): MaybePromise<Settlement>;
  list(filters?: { anchor?: string; asset?: string }): MaybePromise<Settlement[]>;
}

export class PersistentSettlementService extends SettlementService {
  constructor(
    private readonly database: PostgresPersistence,
    private readonly durableSettlements: PersistentSettlementRepository,
    liquidity: import("../repositories/persistentRepositories").PersistentLiquidityRepository,
    anchors: AnchorService,
    feeBps: bigint | number,
  ) {
    super(durableSettlements, liquidity, anchors, feeBps);
    this.durableFeeBps = BigInt(feeBps);
  }

  private readonly durableFeeBps: bigint;

  open(input: { anchor: unknown; asset: unknown; amount: unknown }): any {
    return this.openAsync(input);
  }

  private async openAsync(input: { anchor: unknown; asset: unknown; amount: unknown }): Promise<Settlement> {
    const anchor = requireString(input.anchor, "anchor");
    const asset = normalizeAsset(input.asset);
    const amount = requireBigInt(input.amount, "amount");

    // The active-anchor check remains in the domain service, preserving its
    // error code and wording without making a second database lookup here.
    if (!this.anchors.isActive(anchor)) {
      throw ApiError.badRequest(
        `anchor "${anchor}" is not an active registered anchor`,
        "ANCHOR_NOT_ACTIVE",
      );
    }

    const fee = (amount * this.durableFeeBps + 9_999n) / 10_000n;
    try {
      const created = await this.database.openSettlement({
        anchor,
        asset,
        amount,
        fee,
        createdAt: new Date().toISOString(),
      });
      this.durableSettlements.hydrate(created);
      this.rebuildAccounting();
      return created;
    } catch (error) {
      if (error instanceof Error && error.name === "InsufficientLiquidityError") {
        const available = super.available(asset);
        throw ApiError.badRequest(
          `insufficient liquidity for ${asset}: requested ${amount}, available ${available}`,
          "INSUFFICIENT_LIQUIDITY",
        );
      }
      throw error;
    }
  }

  execute(idInput: unknown): any {
    return this.executeAsync(idInput);
  }

  private async executeAsync(idInput: unknown): Promise<Settlement> {
    const id = requirePositiveInteger(idInput, "id");
    const current = super.get(id);
    if (current.status !== "pending") {
      throw ApiError.conflict(
        `settlement ${id} is ${current.status}, not pending`,
        "INVALID_STATE",
      );
    }
    const updated = await this.database.transitionSettlement(id, "executed");
    this.durableSettlements.hydrate(updated);
    this.rebuildAccounting();
    return updated;
  }

  cancel(idInput: unknown, reasonInput?: unknown): any {
    return this.cancelAsync(idInput, reasonInput);
  }

  private async cancelAsync(idInput: unknown, reasonInput?: unknown): Promise<Settlement> {
    const id = requirePositiveInteger(idInput, "id");
    const current = super.get(id);
    if (current.status !== "pending") {
      throw ApiError.conflict(
        `settlement ${id} is ${current.status}, not pending`,
        "INVALID_STATE",
      );
    }
    const reason =
      reasonInput === undefined
        ? undefined
        : requireStringMaxLength(reasonInput, "reason", 500);
    const updated = await this.database.transitionSettlement(id, "cancelled", reason);
    this.durableSettlements.hydrate(updated);
    this.rebuildAccounting();
    return updated;
  }

  async flush(): Promise<void> {
    await this.database.flush();
  }

}
