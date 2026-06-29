// Server-only: CoW Protocol quote — upstream fetch + normalization.
// Merged from app/api/cow-quote/route.ts (proxy) + lib/desks/cow.ts (normalizer).
import { fromRaw } from "@/lib/fx-provider/core/format";
import type { NormalizedQuote, QuoteParams, QuoteResult } from "../../desks/source";

const COW = "https://api.cow.fi/mainnet/api/v1/quote";

interface CowOrderQuote {
  sellToken?: string;
  buyToken?: string;
  sellAmount?: string;
  buyAmount?: string;
  validTo?: number;
  appData?: string;
  feeAmount?: string;
  kind?: string;
  partiallyFillable?: boolean;
  sellTokenBalance?: string;
  buyTokenBalance?: string;
}
interface CowResponse {
  quote?: CowOrderQuote;
  verified?: boolean;
  errorType?: string;
  description?: string;
}

export async function cowServerQuote(p: QuoteParams): Promise<QuoteResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  const taker = p.owner ?? "0x0000000000000000000000000000000000000001";
  try {
    const payload = {
      sellToken: p.fromAddress,
      buyToken: p.toAddress,
      from: taker,
      receiver: taker,
      sellAmountBeforeFee: p.fromAmountRaw,
      kind: "sell" as const,
      partiallyFillable: false,
      signingScheme: "eip712" as const,
      appData: "{}",
    };
    const res = await fetch(COW, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}) as CowResponse);
    if (!res.ok) {
      const d = data as CowResponse;
      const msg = d.description ?? `CoW ${res.status}`;
      return {
        ok: false,
        reason: res.status === 404 || res.status === 400 ? "no_liquidity" : "error",
        message: msg,
      };
    }
    const d = data as CowResponse;
    const buyAmount = d.quote?.buyAmount;
    if (!buyAmount) {
      return { ok: false, reason: "error", message: "no quote" };
    }
    const q = d.quote!;
    const inHuman = Number(fromRaw(p.fromAmountRaw, p.fromDecimals));
    const outHuman = Number(fromRaw(buyAmount, p.toDecimals));
    const quote: NormalizedQuote = {
      source: "cow",
      toolName: "CoW solver",
      amountInRaw: q.sellAmount ?? p.fromAmountRaw,
      amountOutRaw: buyAmount,
      amountOutGrossRaw: buyAmount,
      rate: inHuman > 0 ? outHuman / inHuman : 0,
      verified: d.verified,
      tokenIn: p.fromAddress,
      cowOrder: {
        sellToken: q.sellToken ?? p.fromAddress,
        buyToken: q.buyToken ?? p.toAddress,
        sellAmount: q.sellAmount ?? p.fromAmountRaw,
        buyAmount,
        validTo: q.validTo ?? Math.floor(Date.now() / 1000) + 1200,
        appData: q.appData ?? "0x0000000000000000000000000000000000000000000000000000000000000000",
        feeAmount: q.feeAmount ?? "0",
        kind: q.kind ?? "sell",
        partiallyFillable: q.partiallyFillable ?? false,
        sellTokenBalance: q.sellTokenBalance ?? "erc20",
        buyTokenBalance: q.buyTokenBalance ?? "erc20",
      },
      raw: d,
    };
    return { ok: true, quote };
  } catch (e) {
    const aborted = (e as Error).name === "AbortError";
    return {
      ok: false,
      reason: "error",
      message: aborted ? "CoW timed out" : `CoW failed: ${(e as Error).message}`,
    };
  } finally {
    clearTimeout(timer);
  }
}
