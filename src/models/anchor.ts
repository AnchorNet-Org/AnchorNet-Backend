/**
 * Domain models for registered anchors.
 */

/** A liquidity-providing anchor approved to participate in the network. */
export interface Anchor {
  /** Stellar account id or home domain identifying the anchor. */
  id: string;
  /** Human-readable display name. */
  name: string;
  /** ISO-8601 timestamp of when the anchor was registered. */
  registeredAt: string;
  /** Whether the anchor is currently active. */
  active: boolean;
}
