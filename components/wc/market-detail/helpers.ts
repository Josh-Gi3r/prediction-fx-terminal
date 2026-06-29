/**
 * Shared formatting helpers and types for the MarketDetail surface.
 */

export interface TradeEntry {
  price: number;
  timestamp: number;
}

// Shape of trades from PM data API
export interface PmTrade {
  price?: number | string;
  timestamp?: number | string;
  side?: string;
  size?: number | string;
  /** "Yes" | "No" — the outcome this trade was on. */
  outcome?: string;
  /** 0 = Yes, 1 = No. */
  outcomeIndex?: number;
}

export const DETAIL_PLAYER_CATS = new Set([
  "golden_boot",
  "golden_ball",
  "golden_glove",
  "assists",
  "goal_contrib",
  "clean_sheets",
]);

export function fmtCents(price: number | null | undefined): string {
  if (price == null) return "—";
  return `${Math.round(price * 100)}¢`;
}

export function fmtShares(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toFixed(0);
}

export function fmtDollar(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
}
