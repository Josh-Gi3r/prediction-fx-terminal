// Server-only: LiFi quote — upstream fetch + normalization.
// Merged from app/api/lifi-quote/route.ts (proxy) + lib/desks/lifi.ts (normalizer).
import { fromRaw } from "@/lib/fx-provider/core/format";
import type { NormalizedQuote, QuoteParams, QuoteResult } from "../../desks/source";

const LIFI = "https://li.quest/v1/quote";
const INTEGRATOR = process.env.NEXT_PUBLIC_LIFI_INTEGRATOR ?? "predfx-terminal";

interface LifiEstimate {
  toAmount?: string;
  toAmountMin?: string;
  fromAmount?: string;
  approvalAddress?: string;
  gasCosts?: Array<{ amountUSD?: string }>;
}
interface LifiQuoteResponse {
  estimate?: LifiEstimate;
  tool?: string;
  toolDetails?: { name?: string };
  transactionRequest?: { to?: string; data?: string; value?: string; chainId?: number };
  message?: string;
}

export async function lifiServerQuote(p: QuoteParams): Promise<QuoteResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const fromAddress = p.owner ?? "0x0000000000000000000000000000000000000001";
    const qs = new URLSearchParams({
      fromChain: "1",
      toChain: "1",
      fromToken: p.fromAddress,
      toToken: p.toAddress,
      fromAmount: p.fromAmountRaw,
      fromAddress,
      integrator: INTEGRATOR,
      // TODO(account/settings): wire slippageBps from AccountPrefs through QuoteParams so
      // the user-configured slippage is respected here. Requires adding slippageBps to
      // QuoteParams (source.ts), threading it through useQuotes (hooks.ts) + /api/quotes route.
      // Currently hardcoded at 0.5%; the preference is stored in localStorage and visible in Settings.
      slippage: "0.005",
    });
    const headers: Record<string, string> = {};
    if (process.env.LIFI_API_KEY) headers["x-lifi-api-key"] = process.env.LIFI_API_KEY;
    const res = await fetch(`${LIFI}?${qs}`, { signal: ctrl.signal, cache: "no-store", headers });
    const data = await res.json().catch(() => ({}) as LifiQuoteResponse);
    if (!res.ok) {
      const msg = (data as { message?: string }).message ?? `LiFi ${res.status}`;
      const noLiq = res.status === 404;
      return { ok: false, reason: noLiq ? "no_liquidity" : "error", message: msg };
    }
    const d = data as LifiQuoteResponse;
    const e = d.estimate;
    if (!e?.toAmountMin) {
      return { ok: false, reason: "error", message: "no route" };
    }
    const inHuman = Number(fromRaw(e.fromAmount ?? p.fromAmountRaw, p.fromDecimals));
    const outHuman = Number(fromRaw(e.toAmountMin, p.toDecimals));
    const feeUsd = e.gasCosts?.[0]?.amountUSD ? Number(e.gasCosts[0].amountUSD) : undefined;
    const quote: NormalizedQuote = {
      source: "lifi",
      toolName: d.toolDetails?.name ?? d.tool ?? "LiFi",
      amountInRaw: e.fromAmount ?? p.fromAmountRaw,
      tokenIn: p.fromAddress,
      approvalAddress: e.approvalAddress,
      amountOutRaw: e.toAmountMin,
      amountOutGrossRaw: e.toAmount ?? e.toAmountMin,
      rate: inHuman > 0 ? outHuman / inHuman : 0,
      feeUsd,
      transactionRequest: d.transactionRequest,
      raw: d,
    };
    return { ok: true, quote };
  } catch (e) {
    const aborted = (e as Error).name === "AbortError";
    return {
      ok: false,
      reason: "error",
      message: aborted ? "LiFi timed out" : `LiFi failed: ${(e as Error).message}`,
    };
  } finally {
    clearTimeout(timer);
  }
}
