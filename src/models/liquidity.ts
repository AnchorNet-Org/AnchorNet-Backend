/**
 * Domain models for liquidity pools and routing quotes.
 */

/** A single anchor's liquidity contribution to an asset pool. */
export interface LiquidityEntry {
  /** Stellar anchor identifier (account or home domain). */
  anchor: string;
  /** Asset code the liquidity is denominated in (e.g. "USDC"). */
  asset: string;
  /** Amount of liquidity provided, in the asset's smallest unit. */
  amount: number;
  /** ISO-8601 timestamp of the last update. */
  updatedAt: string;
}

/** Aggregate liquidity available for an asset across all anchors. */
export interface Pool {
  asset: string;
  total: number;
  anchors: number;
}

/** A request to route `amount` of `asset` through available liquidity. */
export interface QuoteRequest {
  asset: string;
  amount: number;
}

/** A single leg in a multi-anchor route. */
export interface RouteEntry {
  /** Anchor identifier supplying the portion. */
  anchor: string;
  /** Amount sourced from this anchor, in the asset's smallest unit. */
  portion: number;
}

/** A computed routing quote for a {@link QuoteRequest}. */
export interface Quote {
  asset: string;
  amount: number;
  /** Protocol fee charged for routing, in the asset's smallest unit. */
  fee: number;
  /** Amount delivered after fees. */
  deliverable: number;
  /** Anchors selected to source the liquidity, largest first, with per-anchor portions. */
  route: RouteEntry[];
}
