/**
 * Domain models for cross-anchor settlements.
 */

/** Lifecycle state of a settlement, mirroring the on-chain contract. */
export type SettlementStatus = "pending" | "executed" | "cancelled";

/** A settlement that draws liquidity from a pool to settle a payment. */
export interface Settlement {
  /** Monotonic identifier assigned by the service. */
  id: number;
  /** Anchor that requested the settlement. */
  anchor: string;
  /** Asset being settled. */
  asset: string;
  /** Gross amount reserved from the pool. */
  amount: number;
  /** Protocol fee withheld from the amount. */
  fee: number;
  /** Current lifecycle state. */
  status: SettlementStatus;
  /** ISO-8601 timestamp of creation. */
  createdAt: string;
}
