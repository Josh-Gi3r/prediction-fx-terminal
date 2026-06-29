/**
 * lib/desks/quoteEconomics.ts
 *
 * Pure, framework-free helpers for quote economics: gas conversion, net-out
 * annotation, desk ranking, FX provider near-tie bias, and best-desk selection.
 *
 * Extracted from app/api/quotes/route.ts so that:
 *   1. route.ts imports the real implementations (no drift).
 *   2. route.test.ts imports the same functions (tests prove the real math, not
 *      a copy — this was the mask that hid P0-A before extraction).
 *
 * No Next.js / React / wagmi imports allowed here. Pure TS + bigint.
 */

import type { NormalizedQuote } from "./source";

// ─── Types ────────────────────────────────────────────────────────────────────

export type QuoteSource = "fx-provider" | "lifi" | "kyber" | "cow";

// ─── Gas → output-token units conversion ─────────────────────────────────────

/**
 * Convert a gas cost in USD to raw output-token units.
 *
 * USD-stable corridors (USDC, USDT, XSGD, MYRX …) are pegged near $1 at par.
 * We convert at par unless the quote's implied rate (outHuman / inHuman) diverges
 * from 1 by more than 5%, in which case we use the rate to convert
 * gasUsd → output-token human → raw.
 */
export function gasUsdToOutRaw(
  gasUsd: number,
  toDecimals: number,
  impliedRate?: number, // outHuman / inHuman from the quote
): bigint {
  if (gasUsd <= 0) return 0n;
  const rate = impliedRate && impliedRate > 0 ? impliedRate : 1;
  const usdPerOutputToken = Math.abs(rate - 1) > 0.05 ? rate : 1;
  const gasOutHuman = gasUsd / usdPerOutputToken;
  return BigInt(Math.round(gasOutHuman * 10 ** toDecimals));
}

// ─── Annotate a quote with gasUsd + netOutRaw ─────────────────────────────────

/**
 * Attach `gasUsd` and `netOutRaw` to a quote.
 *
 * Net basis:
 *   - lifi / kyber → net derives from `amountOutRaw` (the haircut / toAmountMin
 *     committed minimum). We never use `amountOutGrossRaw` here — doing so was
 *     P0-A: the headline would show the optimistic pre-slippage mid while the
 *     on-chain execution enforces the lower minimum.
 *   - fx-provider / cow   → already use `amountOutRaw` (post-$1-fee or solver amount).
 *     No change needed, but the uniform branch below keeps the logic explicit.
 *
 * `amountOutGrossRaw` is preserved on the quote for executor use (e.g. FX provider
 * routeParams reconstruction) but is NEVER the basis for the displayed number.
 */
export function annotate(
  quote: NormalizedQuote,
  gasUsd: number,
  toDecimals: number,
): NormalizedQuote {
  const gasRaw = gasUsdToOutRaw(gasUsd, toDecimals, quote.rate);

  // P0-A fix: ALL venues use amountOutRaw (the guaranteed minimum / post-fee amount).
  // lifi: toAmountMin (slippage-protected); kyber: haircut amountOut; fx-provider: minOutputAmount;
  // cow: buyAmount (solver-committed minimum).
  const outRaw = BigInt(quote.amountOutRaw);

  // netOutRaw cannot go below zero — a desk where gas > output is unusable but
  // we clamp rather than produce a negative string.
  const netOut = outRaw > gasRaw ? outRaw - gasRaw : 0n;
  return { ...quote, gasUsd, netOutRaw: netOut.toString() };
}

// ─── Ranking ──────────────────────────────────────────────────────────────────

/** Extract the net deliverable from an annotated quote. */
export function netOf(quote: NormalizedQuote): bigint {
  return quote.netOutRaw ? BigInt(quote.netOutRaw) : BigInt(quote.amountOutRaw);
}

/**
 * Sort desks descending by netOutRaw. Pure — returns a new array.
 */
export function rankDesks(
  desks: Array<[QuoteSource, { ok: true; quote: NormalizedQuote }]>,
): Array<[QuoteSource, { ok: true; quote: NormalizedQuote }]> {
  return [...desks].sort((a, b) => (netOf(b[1].quote) > netOf(a[1].quote) ? 1 : -1));
}

// ─── FX provider near-tie bias ───────────────────────────────────────────────────────

/** 10 basis points — prefer FX provider when within 0.1% of the best on net. */
export const FX_PROVIDER_BIAS_BPS = 10n;

/**
 * Apply FX provider near-tie bias: if FX provider is within FX_PROVIDER_BIAS_BPS of the current best
 * on net basis, route to FX provider (FX-corridor wedge — FX provider is the home desk).
 *
 * Skips if FX provider is already best.
 */
export function applyFxProviderBias(
  bestSource: QuoteSource,
  bestNetRaw: bigint,
  fxProviderNetRaw: bigint,
): QuoteSource {
  if (bestSource === "fx-provider") return "fx-provider";
  if (fxProviderNetRaw * 10_000n >= bestNetRaw * (10_000n - FX_PROVIDER_BIAS_BPS)) {
    return "fx-provider";
  }
  return bestSource;
}

// ─── Best-desk selection ──────────────────────────────────────────────────────

/**
 * Select the best executable desk from annotated results.
 *
 * Rules:
 *   1. Rank all ok desks by netOutRaw descending.
 *   2. CoW is excluded from execCands (intent — may not fill). Falls back to CoW
 *      only if it is the sole ok quote.
 *   3. Apply FX provider near-tie bias if FX provider is available and not already best.
 *
 * Returns null when no desk has a quote.
 */
export function selectBest(
  results: Array<[QuoteSource, { ok: boolean; quote?: NormalizedQuote }]>,
): QuoteSource | null {
  const okPairs = results.filter(
    (r): r is [QuoteSource, { ok: true; quote: NormalizedQuote }] => r[1].ok && !!r[1].quote,
  );

  const ranked = rankDesks(okPairs);
  const execCands = ranked.filter(([src]) => src !== "cow");

  // CoW fallback — only if it is the sole ok quote.
  const activeCands = execCands.length > 0 ? execCands : ranked;
  if (activeCands.length === 0) return null;

  const first = activeCands[0]!;
  let bestSource = first[0];

  // FX provider bias
  const fxProviderResult = okPairs.find(([s]) => s === "fx-provider");
  if (bestSource !== "fx-provider" && fxProviderResult) {
    bestSource = applyFxProviderBias(bestSource, netOf(first[1].quote), netOf(fxProviderResult[1].quote));
  }

  return bestSource;
}
