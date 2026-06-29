/**
 * lib/polymarket/useBetEconomics.ts
 *
 * Single source of truth for all bet math on the WC prediction surface.
 *
 * CANONICAL MODEL
 * ───────────────
 * Everything normalises to (limitPrice, size) — the two values the CLOB SDK
 * receives.  Both surfaces (BetSheet, BetSlip) may collect different user inputs
 * (shares vs USDC dollars) but they converge here before producing:
 *
 *   - limitPrice  — tick-snapped price in [0, 1]
 *   - size        — shares, floored to integer, min-clamped to minSize
 *   - costRaw     — USDC.e approval amount as bigint (6 decimals), ceil-rounded
 *                   from the canonical cost = limitPrice * size (NOT the raw
 *                   dollar input when driving by USDC)
 *   - payout      — shares (= USDC.e if market resolves in favour)
 *   - profit      — payout - cost (floating display value)
 *   - displayShares / displayCost — pre-formatted display strings
 *
 * Both surfaces pass the same (limitPrice, size) to placeBet() and the same
 * costRaw to useUsdcApproval().  No divergence is possible once both surfaces
 * consume this module.
 *
 * PURE HELPERS
 * ────────────
 * computeBetEconomics() is a pure function; it can be called anywhere including
 * unit tests without a React context.
 *
 * useBetEconomics() is a thin React wrapper around it for use in hooks.
 */

import { useMemo } from "react";
import { usdcToRaw } from "./order";

// ─── types ────────────────────────────────────────────────────────────────────

/**
 * Market parameters required to compute bet economics.
 * Subset of WcLiveMarket — only the fields this module needs.
 */
export interface BetMarketParams {
  /** Current YES price 0-1. */
  yesPrice: number | null;
  /** Current NO price 0-1. */
  noPrice: number | null;
  /** CLOB best bid (fallback if yesPrice is null). */
  bestBid: number | null;
  /** Polymarket tick size for this market ("0.1" | "0.01" | "0.001" | "0.0001"). */
  tickSize: number;
  /** Minimum order size in shares (market-specific floor). */
  minOrderSize: number;
  /** Whether the market uses the negRisk exchange. */
  negRisk: boolean;
}

/** How the user input is denominated. */
export type BetInputUnit = "shares" | "usdc";

/** Result of computeBetEconomics / useBetEconomics. */
export interface BetEconomics {
  /**
   * Tick-snapped limit price in [0, 1].
   * This is what gets passed to placeBet({ price }).
   */
  limitPrice: number;
  /**
   * Canonical share count — floored, min-clamped, ready for placeBet({ size }).
   * This is the SAME value regardless of whether input was in shares or dollars.
   */
  size: number;
  /**
   * USDC.e cost as raw bigint (6 decimals).
   * Derived from limitPrice * size, NOT from the raw dollar input.
   * This is what gets passed to useUsdcApproval as costRawUsdc.
   */
  costRaw: bigint;
  /**
   * Floating-point cost in USDC.e dollars (= limitPrice * size).
   * For display only — approval uses costRaw.
   */
  cost: number;
  /**
   * Max payout in USDC.e dollars if the market resolves in favour.
   * Always equal to size (1 share = $1).
   */
  payout: number;
  /**
   * Profit if the market resolves in favour (payout - cost).
   * Display only.
   */
  profit: number;
  /** Pre-formatted share count string for UI. */
  displayShares: string;
  /** Pre-formatted cost string for UI, e.g. "$10.38". */
  displayCost: string;
}

// ─── global floor ─────────────────────────────────────────────────────────────

/** Polymarket global minimum order size. Market minOrderSize may be higher. */
export const PM_MIN_SIZE = 5;

// ─── pure helpers ─────────────────────────────────────────────────────────────

/**
 * Snap a price to the nearest tick boundary.
 * Matches the helper used in BetSheet / BetSlip before this refactor.
 */
export function snapToTick(price: number, tick: number): number {
  return Math.round(price / tick) * tick;
}

/**
 * Clamp a value to [lo, hi].
 */
export function clampPrice(val: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, val));
}

/**
 * Derive the effective limit price for a given side from market params.
 *
 * Priority: yesPrice/noPrice (live mid) → bestBid fallback → 0.5.
 * The result is tick-snapped and clamped to [tick, 1-tick] so it is
 * always a valid FOK price.
 *
 * If customPrice is provided (0 < customPrice < 1) it takes precedence
 * after tick-snapping.
 */
export function derivePrice(
  side: "yes" | "no",
  market: BetMarketParams,
  customPrice?: number,
): number {
  const tick = market.tickSize;

  if (
    customPrice !== undefined &&
    !Number.isNaN(customPrice) &&
    customPrice > 0 &&
    customPrice < 1
  ) {
    return snapToTick(customPrice, tick);
  }

  const base =
    side === "yes"
      ? (market.yesPrice ?? market.bestBid ?? 0.5)
      : (market.noPrice ?? 1 - (market.yesPrice ?? market.bestBid ?? 0.5));

  return snapToTick(clampPrice(base, tick, 1 - tick), tick);
}

/**
 * Compute all bet economics from a user input.
 *
 * @param inputUnit  "shares" — input is a share count (desktop BetSheet)
 *                  "usdc"   — input is a USDC dollar amount (mobile BetSlip)
 * @param inputValue The numeric value from the user (shares or dollars).
 * @param limitPrice The tick-snapped limit price (from derivePrice).
 * @param minOrderSize Effective minimum share count (max(PM_MIN_SIZE, market.minOrderSize)).
 *
 * Returns a fully consistent BetEconomics object.  Both surfaces derive the
 * same on-chain size and costRaw for the same economic intent.
 */
export function computeBetEconomics(
  inputUnit: BetInputUnit,
  inputValue: number,
  limitPrice: number,
  minOrderSize: number,
): BetEconomics {
  // ── derive canonical share count ──────────────────────────────────────────
  let rawShares: number;

  if (inputUnit === "shares") {
    // Desktop: user entered shares directly.  Use as-is; floor to whole number.
    rawShares = Math.floor(inputValue);
  } else {
    // Mobile: user entered a USDC dollar amount.
    // shares = floor(dollars / limitPrice), matching the SDK's integer model.
    rawShares = limitPrice > 0 ? Math.floor(inputValue / limitPrice) : 0;
  }

  // Apply the min-size floor exactly once, consistently on both surfaces.
  const size = Math.max(minOrderSize, rawShares);

  // ── derive canonical cost from (limitPrice × size) ────────────────────────
  // NOTE: we derive cost FROM the canonical size, not from the raw dollar input.
  // This ensures the approval amount exactly covers the actual order, regardless
  // of which input surface produced it.
  const cost = limitPrice * size;

  // Ceil-round to the next raw unit so approval always covers cost.
  const costRaw = usdcToRaw(cost);

  // ── payout and profit ─────────────────────────────────────────────────────
  const payout = size; // 1 share resolves to $1.00 USDC.e
  const profit = payout - cost;

  // ── display strings ───────────────────────────────────────────────────────
  const displayShares = size.toLocaleString("en-US");
  const displayCost = `$${cost.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  return {
    limitPrice,
    size,
    costRaw,
    cost,
    payout,
    profit,
    displayShares,
    displayCost,
  };
}

// ─── React hook ───────────────────────────────────────────────────────────────

/**
 * React hook wrapping computeBetEconomics + derivePrice.
 *
 * Usage in BetSheet (shares input):
 *   const econ = useBetEconomics("shares", shareCount, side, market);
 *
 * Usage in BetSlip (USDC input):
 *   const econ = useBetEconomics("usdc", dollarAmount, side, market);
 *
 * Both return the same { limitPrice, size, costRaw, … } shape.
 * Pass econ.limitPrice + econ.size to placeBet().
 * Pass econ.costRaw to useUsdcApproval().
 *
 * @param inputUnit    "shares" or "usdc"
 * @param inputValue   User-entered number (shares or dollars)
 * @param side         "yes" or "no"
 * @param market       Market params (tickSize, minOrderSize, prices)
 * @param customPrice  Optional custom limit price override (0 < p < 1)
 */
export function useBetEconomics(
  inputUnit: BetInputUnit,
  inputValue: number,
  side: "yes" | "no",
  market: BetMarketParams,
  customPrice?: number,
): BetEconomics {
  return useMemo(() => {
    const limitPrice = derivePrice(side, market, customPrice);
    const minOrderSize = Math.max(PM_MIN_SIZE, market.minOrderSize);
    return computeBetEconomics(inputUnit, inputValue, limitPrice, minOrderSize);
  }, [inputUnit, inputValue, side, market, customPrice]);
}
