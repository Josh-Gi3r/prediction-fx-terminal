// Server-only: KyberSwap quote — upstream fetch + normalization.
// Merged from app/api/kyber-quote/route.ts (proxy) + lib/desks/kyber.ts (normalizer).
import { fromRaw } from "@/lib/fx-provider/core/format";
import type { NormalizedQuote, QuoteParams, QuoteResult } from "../../desks/source";

const KYBER = "https://aggregator-api.kyberswap.com/ethereum/api/v1/routes";
const HAIRCUT_BPS = 50n;

interface KyberRouteSummary {
  amountOut?: string;
  gasUsd?: string;
  route?: Array<Array<{ exchange?: string }>>;
}
interface KyberResponse {
  data?: { routeSummary?: KyberRouteSummary };
  message?: string;
}

function primaryExchange(rs: KyberRouteSummary): string {
  return rs.route?.[0]?.[0]?.exchange ?? "Kyber";
}

export async function kyberServerQuote(p: QuoteParams): Promise<QuoteResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const qs = new URLSearchParams({
      tokenIn: p.fromAddress,
      tokenOut: p.toAddress,
      amountIn: p.fromAmountRaw,
    });
    const res = await fetch(`${KYBER}?${qs}`, {
      signal: ctrl.signal,
      cache: "no-store",
      headers: { "X-Client-Id": "predfx-terminal" },
    });
    const data = await res.json().catch(() => ({}) as KyberResponse);
    if (!res.ok) {
      const msg = (data as { message?: string }).message ?? `Kyber ${res.status}`;
      return { ok: false, reason: res.status === 404 ? "no_liquidity" : "error", message: msg };
    }
    const d = data as KyberResponse;
    const rs = d.data?.routeSummary;
    if (!rs?.amountOut) {
      return { ok: false, reason: "error", message: "no route" };
    }
    const out = BigInt(rs.amountOut);
    const haircut = (out * (10_000n - HAIRCUT_BPS)) / 10_000n;
    const inHuman = Number(fromRaw(p.fromAmountRaw, p.fromDecimals));
    const outHuman = Number(fromRaw(haircut.toString(), p.toDecimals));
    const quote: NormalizedQuote = {
      source: "kyber",
      toolName: primaryExchange(rs),
      amountInRaw: p.fromAmountRaw,
      amountOutRaw: haircut.toString(),
      amountOutGrossRaw: rs.amountOut,
      rate: inHuman > 0 ? outHuman / inHuman : 0,
      feeUsd: rs.gasUsd ? Number(rs.gasUsd) : undefined,
      haircutBps: Number(HAIRCUT_BPS),
      tokenIn: p.fromAddress,
      tokenOut: p.toAddress,
      routeSummary: rs,
      raw: d,
    };
    return { ok: true, quote };
  } catch (e) {
    const aborted = (e as Error).name === "AbortError";
    return {
      ok: false,
      reason: "error",
      message: aborted ? "Kyber timed out" : `Kyber failed: ${(e as Error).message}`,
    };
  } finally {
    clearTimeout(timer);
  }
}
