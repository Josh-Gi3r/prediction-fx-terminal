import { rateLimit } from "@/lib/api/rateLimit";
// POST /api/quotes — server-side fanout to all 4 desks, ranking, FX provider bias.
// Routing brain + FX_PROVIDER_BIAS_BPS live server-side only; client receives ranked result.
import { parseJsonBody, zAddress, zDecimals, zRawAmount } from "@/lib/api/validate";
import { annotate, selectBest } from "@/lib/desks/quoteEconomics";
import type { NormalizedQuote, QuoteParams, QuoteResult } from "@/lib/desks/source";
import { cowServerQuote } from "@/lib/server/quotes/cow";
import { kyberServerQuote } from "@/lib/server/quotes/kyber";
import { lifiServerQuote } from "@/lib/server/quotes/lifi";
import { fxProviderQuote } from "@/lib/server/quotes/fx-provider";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

// Gas model — CALIBRATED FROM REAL TRADES (2026-06-12 live tests):
//   fx-provider — GASLESS for the user. Executor submits and pays; the flat $1 fee
//   (already inside the quote) is the entire cost. Measured: exactly so.
//   Aggregators — live chain gas price x measured units x ETH/USD.
//   Measured: LiFi approve+swap = 467k units ($0.101 @0.13 gwei);
//   Kyber approve+swap = ~330k ($0.08). Priority mult measured at 1.15x base.
//   We use 450k units + 1.3x mult as a safety margin, refreshed every 60s.
const AGG_GAS_UNITS = 450_000;
const GAS_PRIORITY_MULT = 1.3;
const AGG_GAS_FALLBACK_USD = 0.5; // if gas/price feeds fail
let _gasCache: { usd: number; at: number } | null = null;

async function liveAggGasUsd(): Promise<number> {
  const now = Date.now();
  if (_gasCache && now - _gasCache.at < 60_000) return _gasCache.usd;
  try {
    const rpcRes = await fetch("https://ethereum-rpc.publicnode.com", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_gasPrice", params: [] }),
      signal: AbortSignal.timeout(3_000),
    });
    const gasPriceWei = Number.parseInt((await rpcRes.json()).result, 16);
    const priceRes = await fetch("https://api.coinbase.com/v2/prices/ETH-USD/spot", {
      signal: AbortSignal.timeout(3_000),
    });
    const ethUsd = Number((await priceRes.json()).data.amount);
    if (!Number.isFinite(gasPriceWei) || !Number.isFinite(ethUsd) || ethUsd <= 0)
      return AGG_GAS_FALLBACK_USD;
    const usd = ((gasPriceWei * GAS_PRIORITY_MULT * AGG_GAS_UNITS) / 1e18) * ethUsd;
    _gasCache = { usd, at: now };
    return usd;
  } catch {
    return AGG_GAS_FALLBACK_USD;
  }
}

// ─── Quote stability: last-good cache ─────────────────────────────────────────
// Upstreams hiccup; without this a single timeout flashes "no route" on a desk
// that quoted fine 15s ago. On failure we serve that desk's last good quote for
// the SAME params if it is fresh (< 30s).
//
// P0-C: FX provider quotes are EXCLUDED from last-good. An FX provider uuid is single-use and
// time-boxed (The provider's own expiry is ~120s but the uuid is consumed on first use).
// Serving a cached FX provider uuid on a retry would produce a 400/expired error at
// submit time. Stateless aggregator quotes (lifi/kyber/cow) carry no uuid and
// are safe to serve stale for 30s.
const LAST_GOOD_TTL_MS = 30_000;
const _lastGood = new Map<string, { quote: NormalizedQuote; at: number }>();

function lastGoodKey(src: string, p: QuoteParams): string {
  return `${src}:${p.fromAddress}:${p.toAddress}:${p.fromAmountRaw}`;
}

const QuotesBodySchema = z.object({
  fromAddress: zAddress,
  toAddress: zAddress,
  fromAmountRaw: zRawAmount.refine((v) => v !== "0", { message: "fromAmountRaw cannot be zero" }),
  fromDecimals: zDecimals,
  toDecimals: zDecimals,
  owner: zAddress.optional(),
});

// ─── Response shape ───────────────────────────────────────────────────────────

/** One desk in the /api/quotes response. Every ok desk carries its full
 *  executable NormalizedQuote (so the client can select any desk and execute).
 *  The ranking brain + anti-copy data stays server-side; executable payloads
 *  were never the secret. */
export interface DeskEntry {
  source: "fx-provider" | "lifi" | "kyber" | "cow";
  ok: boolean;
  /** Full quote including netOutRaw + gasUsd. Present only when ok === true. */
  quote?: NormalizedQuote;
  /** Net deliverable as raw integer string (copy of quote.netOutRaw). */
  netOutRaw?: string;
  /** Estimated gas cost in USD (copy of quote.gasUsd). */
  gasUsd?: number;
  /** Human-readable failure reason when ok === false. */
  reason?: string;
}

export interface QuotesResponse {
  /** Server-recommended venue — the source string, not the quote object.
   *  The ranking + FX provider bias logic is server-side (anti-copy boundary).
   *  The client resolves the full quote by finding the matching desk entry. */
  best: "fx-provider" | "lifi" | "kyber" | "cow";
  desks: DeskEntry[];
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { name: "quotes", limit: 60, windowMs: 60_000 });
  if (limited) return limited;

  const parsed = await parseJsonBody(req, QuotesBodySchema, { tag: "quotes" });
  if (!parsed.ok) return parsed.res;
  const b = parsed.data;

  const params: QuoteParams = {
    fromAddress: b.fromAddress,
    toAddress: b.toAddress,
    fromAmountRaw: b.fromAmountRaw,
    fromDecimals: b.fromDecimals,
    toDecimals: b.toDecimals,
    owner: b.owner,
  };

  type Source = "fx-provider" | "lifi" | "kyber" | "cow";
  const sources: Source[] = ["fx-provider", "lifi", "kyber", "cow"];
  const fns = [fxProviderQuote, lifiServerQuote, kyberServerQuote, cowServerQuote];

  // One fast retry per desk on failure, then fall back to last-good (< 30s).
  // FX provider is excluded from last-good (P0-C: uuid is single-use + time-boxed).
  async function stableQuote(src: Source, fn: (p: QuoteParams) => Promise<QuoteResult>) {
    let r: QuoteResult;
    try {
      r = await fn(params);
    } catch (e) {
      r = { ok: false, reason: "error", message: String(e) };
    }
    if (!r.ok) {
      try {
        r = await fn(params);
      } catch {
        /* keep first failure */
      }
    }
    const key = lastGoodKey(src, params);
    if (r.ok) {
      // Only cache stateless aggregator quotes — not FX provider (uuid is single-use).
      if (src !== "fx-provider") {
        _lastGood.set(key, { quote: r.quote, at: Date.now() });
      }
      return [src, r] as [Source, QuoteResult];
    }
    // FX provider never served from last-good (see P0-C comment above).
    if (src !== "fx-provider") {
      const cached = _lastGood.get(key);
      if (cached && Date.now() - cached.at < LAST_GOOD_TTL_MS) {
        return [src, { ok: true, quote: cached.quote }] as [Source, QuoteResult];
      }
    }
    return [src, r] as [Source, QuoteResult];
  }

  const settled = await Promise.allSettled(
    sources.map((src, i) => stableQuote(src, fns[i] as (p: QuoteParams) => Promise<QuoteResult>)),
  );
  const rawResults: Array<[Source, QuoteResult]> = settled.map((s, i) =>
    s.status === "fulfilled"
      ? s.value
      : [sources[i] as Source, { ok: false, reason: "error", message: String(s.reason) }],
  );

  // Annotate each ok quote with gasUsd + netOutRaw.
  // gasUsd sources:
  //   fx-provider  — 0: gasless (executor submits; flat $1 fee is already inside amountOutRaw)
  //   lifi  — live-calibrated approve+swap gas
  //   kyber — live-calibrated approve+swap gas
  //   cow   — 0 (solver pays; fee is already inside buyAmount; gasless for taker)
  const aggGas = await liveAggGasUsd();

  function resolveGasUsd(src: Source): number {
    if (src === "fx-provider") return 0; // gasless: executor submits, $1 fee is all-in
    if (src === "cow") return 0; // solver pays gas; shown for reference only
    return aggGas; // live-calibrated approve+swap gas
  }

  const results: Array<[Source, QuoteResult]> = rawResults.map(([src, r]) => {
    if (!r.ok) return [src, r];
    const gas = resolveGasUsd(src);
    return [src, { ok: true, quote: annotate(r.quote, gas, b.toDecimals) }];
  });

  // selectBest: ranks by netOutRaw, excludes CoW from execCands, applies FX provider bias.
  const bestSource = selectBest(
    results.map(([src, r]) => [src, r.ok ? { ok: true as const, quote: r.quote! } : { ok: false }]),
  );

  if (!bestSource) {
    return NextResponse.json({ error: "no_liquidity" }, { status: 200 });
  }

  // Verify the winning desk has a valid quote (selectBest guarantees this but
  // satisfy the type checker).
  const bestResult = results.find(([s]) => s === bestSource)?.[1];
  if (!bestResult?.ok) {
    return NextResponse.json({ error: "no_liquidity" }, { status: 200 });
  }

  // Build desk entries — every ok desk carries its full executable quote.
  const desks: DeskEntry[] = results.map(([src, r]) => {
    if (!r.ok) {
      return { source: src, ok: false, reason: r.reason };
    }
    return {
      source: src,
      ok: true,
      quote: r.quote,
      netOutRaw: r.quote.netOutRaw,
      gasUsd: r.quote.gasUsd,
    };
  });

  const response: QuotesResponse = { best: bestSource, desks };
  return NextResponse.json(response);
}
