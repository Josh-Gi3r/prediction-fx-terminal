/**
 * lib/desks/quoteDisplay.ts
 *
 * Single source of truth for quote display formatting used by both SwapCard
 * and SwapScreen. Every helper operates on a NormalizedQuote that already has
 * netOutRaw and gasUsd set (annotated server-side in /api/quotes).
 *
 * Design contract:
 *   - netHuman    → the "You receive" headline number (net deliverable)
 *   - rateFrom    → "1 FROM = X TO" using the net amount
 *   - deskSubline → standardised per-desk copy below the amount in desk rows
 *
 * Every number shown to the user = what actually lands in their wallet after
 * the venue's fees, slippage, and network gas. Tap any quote to use that
 * venue instead of our recommended pick.
 */

import { fmt, fromRaw } from "@/lib/fx-provider/core/format";
import type { NormalizedQuote } from "./source";

// ─── Headline number ──────────────────────────────────────────────────────────

/**
 * Human-readable net deliverable for a quote.
 * Uses netOutRaw when present (always is for server-annotated quotes),
 * falls back to amountOutRaw so the helper is safe for any NormalizedQuote.
 */
export function netHuman(quote: NormalizedQuote, toDecimals: number): number {
  const raw = quote.netOutRaw ?? quote.amountOutRaw;
  return Number(fromRaw(raw, toDecimals));
}

// ─── Rate line ────────────────────────────────────────────────────────────────

/**
 * "1 FROM = X TO" rate derived from the net amount.
 * amountIn is the human string the user typed (e.g. "100").
 */
export function rateFrom(
  amountIn: string | number,
  net: number,
  fromSymbol: string,
  toSymbol: string,
): string {
  const inNum = typeof amountIn === "number" ? amountIn : Number(amountIn) || 1;
  const rate = inNum > 0 ? net / inNum : 0;
  return `1 ${fromSymbol} = ${fmt(rate, 6)} ${toSymbol}`;
}

// ─── Sub-line copy ────────────────────────────────────────────────────────────

/**
 * Standardised sub-line text shown below the amount in each desk row.
 *
 * Copy contract (mirrors founder's math):
 *   fx-provider → "no slippage"            (gasless; flat $1 fee already in the quote)
 *   cow   → "request to solvers · no fill guarantee"
 *   lifi  → "fees + gas counted"   (venue fee inside quote, live gas subtracted)
 *   kyber → "fees + gas counted"
 */
export function deskSubline(quote: NormalizedQuote): string {
  const src = quote.source;
  if (src === "fx-provider") {
    return "no slippage";
  }
  if (src === "cow") {
    return "request to solvers · no fill guarantee";
  }
  // lifi and kyber: aggregator routes
  return "fees + gas counted";
}

// ─── Network-cost row value ───────────────────────────────────────────────────

/**
 * Value for the "Network cost" row in the swap breakdown card.
 *
 *   cow   → "none (gasless)"
 *   others → "≈ $X" or "—" when unknown
 *
 * Gas is always included in the net number; this row is informational only.
 */
export function networkCostLabel(quote: NormalizedQuote): string {
  if (quote.source === "cow") return "none (gasless)";
  if (quote.gasUsd != null) return `≈ $${fmt(quote.gasUsd, 2)}`;
  return "—";
}

// ─── Sub-line tone ────────────────────────────────────────────────────────────

/**
 * CSS class suffix ("ok" | "slip") for the sub-line in desk rows.
 *   fx-provider → "ok"   (green: no slippage, deterministic)
 *   cow   → "slip" (muted: intent, no guarantee)
 *   others → "slip" (muted: slippage applies)
 */
export function deskSublineTone(quote: NormalizedQuote): "ok" | "slip" {
  return quote.source === "fx-provider" ? "ok" : "slip";
}
