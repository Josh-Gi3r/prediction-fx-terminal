// Server-only: FX Provider quote — upstream fetch + normalization.
// Merged from app/api/quote/route.ts (proxy) + lib/desks/fx-provider.ts (normalizer).
// No client code; safe to import from app/api route handlers.
import { fromRaw, toRaw } from "@/lib/fx-provider/core/format";
import type { GasMode, SwapQuoteResponse } from "@/lib/fx-provider/core/types";
import { FxApiError, fxClient } from "@/lib/fx-provider/server-client";
import type { NormalizedQuote, QuoteParams, QuoteResult } from "../../desks/source";

const BURN = "0x000000000000000000000000000000000000dEaD";

export async function fxProviderQuote(p: QuoteParams): Promise<QuoteResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);

  try {
    // Anchor expiry to FX provider server clock; fall back to local.
    let now: number;
    try {
      now = Number((await fxClient.getSystemTime()).timestamp);
    } catch {
      now = Math.floor(Date.now() / 1000);
    }

    const owner = p.owner ?? BURN;
    const quoteReq = {
      from_token: p.fromAddress,
      to_token: p.toAddress,
      from_amount: p.fromAmountRaw,
      owner_address: owner,
      recipient: owner,
      expiration: now + 600,
      gas_mode: "receive_less" as GasMode,
    };

    const data: SwapQuoteResponse = await fxClient.postSwapQuote(quoteReq);

    if (!data.route_params) {
      return { ok: false, reason: "no_liquidity", message: "no route_params" };
    }

    const rp = data.route_params;
    const inHuman = Number(fromRaw(rp.maxInputAmount, p.fromDecimals));
    const outHuman = Number(fromRaw(rp.minOutputAmount, p.toDecimals));
    const feeUsd = data.fee_breakdown?.gas_cost_usd
      ? Number(data.fee_breakdown.gas_cost_usd)
      : undefined;
    const gasOutRaw = data.fee_breakdown?.gas_cost_from_token
      ? toRaw(data.fee_breakdown.gas_cost_from_token, p.toDecimals)
      : "0";
    const grossOut = (BigInt(rp.minOutputAmount) + BigInt(gasOutRaw)).toString();

    const quote: NormalizedQuote = {
      source: "fx-provider",
      toolName: "FX Provider",
      uuid: String(data.uuid),
      amountInRaw: rp.maxInputAmount,
      amountOutRaw: rp.minOutputAmount,
      amountOutGrossRaw: grossOut,
      rate: inHuman > 0 ? outHuman / inHuman : 0,
      feeUsd,
      expiresAt: Number(data.expires_at ?? 0),
      permitRequired: !!data.permit,
      routeParams: rp,
      permit: data.permit ?? null,
      raw: data,
    };
    return { ok: true, quote };
  } catch (e) {
    if (e instanceof FxApiError) {
      const msg =
        (typeof e.body === "object" && e.body ? JSON.stringify(e.body) : e.message) ?? "no quote";
      const isNoLiq = /no_liquidity|liquidity/i.test(msg);
      return { ok: false, reason: isNoLiq ? "no_liquidity" : "error", message: msg };
    }
    return { ok: false, reason: "error", message: (e as Error).message ?? "FX provider failed" };
  } finally {
    clearTimeout(timer);
  }
}
