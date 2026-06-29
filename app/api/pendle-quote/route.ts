import { rateLimit } from "@/lib/api/rateLimit";
import { parseQuery, zAddress } from "@/lib/api/validate";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

/**
 * Pendle Hosted SDK proxy — keeps their API host strictly server-side.
 *
 * GET /api/pendle-quote
 *   ?chainId=1
 *   &marketAddress=0x...
 *   &ptAddress=0x...
 *   &tokenIn=0x...           (USDC address)
 *   &amountIn=100000000      (raw, 6 decimals for USDC)
 *   &slippage=0.005          (0.5%)
 *   &receiver=0x...          (user wallet)
 *
 * Returns:
 *   {
 *     tx: { to, data, from }       — raw tx to sign/send
 *     approveAmount: string        — exact raw USDC amount to approve (never unlimited)
 *     approveTo: string            — spender address (Pendle router)
 *     amountOut: string            — raw PT amount (18 decimals)
 *     amountOutHuman: number       — PT amount, human-readable
 *     priceImpact: number          — fractional, e.g. -0.0001 = -0.01%
 *   }
 *
 * On error:
 *   { error: string }  with status 400 or 502
 */

const PENDLE_SDK = "https://api-v2.pendle.finance/core";
const TIMEOUT_MS = 10_000;

// PT tokens are always 18 decimals on Pendle.
const PT_DECIMALS = 18n;

const PendleQuoteSchema = z.object({
  chainId: z.string().regex(/^\d+$/).optional().default("1"),
  marketAddress: zAddress,
  ptAddress: zAddress,
  tokenIn: zAddress,
  amountIn: z
    .string()
    .regex(/^\d+$/, "amountIn must be a positive integer string")
    .refine((v) => v !== "0", "amountIn cannot be zero"),
  slippage: z
    .string()
    .regex(/^\d*\.?\d+$/)
    .optional()
    .default("0.005"),
  receiver: zAddress,
});

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { name: "pendle-quote", limit: 120, windowMs: 60_000 });
  if (limited) return limited;

  const qResult = parseQuery(req, PendleQuoteSchema, { tag: "pendle-quote" });
  if (!qResult.ok) return qResult.res;
  const { chainId, marketAddress, ptAddress, tokenIn, amountIn, slippage, receiver } = qResult.data;

  const url = new URL(`${PENDLE_SDK}/v2/sdk/${chainId}/markets/${marketAddress}/swap`);
  url.searchParams.set("tokenIn", tokenIn);
  url.searchParams.set("tokenOut", ptAddress);
  url.searchParams.set("amountIn", amountIn);
  url.searchParams.set("slippage", slippage);
  url.searchParams.set("receiver", receiver);
  url.searchParams.set("enableAggregator", "true");

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url.toString(), {
      signal: ctrl.signal,
      headers: { accept: "application/json" },
      cache: "no-store",
    });

    const body = await res.json();

    if (!res.ok) {
      const msg =
        typeof body?.message === "string"
          ? body.message
          : Array.isArray(body?.message)
            ? body.message.join("; ")
            : `Pendle SDK ${res.status}`;
      console.error("[pendle-quote] Pendle upstream error:", msg);
      return NextResponse.json({ error: "pendle_quote_failed" }, { status: 502 });
    }

    // body shape verified against live API:
    // body.tx = { to, data, from }
    // body.tokenApprovals = [{ token, amount }]
    // body.data = { amountOut: string (raw 18-dec), priceImpact: number }
    const tx: { to: string; data: string; from?: string } = body.tx;
    const approvals: Array<{ token: string; amount: string }> = body.tokenApprovals ?? [];
    const amountOutRaw: string = body.data?.amountOut ?? "0";
    const priceImpact: number = body.data?.priceImpact ?? 0;

    if (!tx?.to || !tx?.data) {
      return NextResponse.json({ error: "pendle_quote_incomplete" }, { status: 502 });
    }

    const approval =
      approvals.find((a) => a.token.toLowerCase() === tokenIn.toLowerCase()) ?? approvals[0];

    const approveAmount = approval?.amount ?? amountIn;
    const approveTo = tx.to; // Pendle router is the spender

    // Human-readable PT out
    const amountOutHuman =
      Number((BigInt(amountOutRaw) * 1_000_000n) / 10n ** PT_DECIMALS) / 1_000_000;

    return NextResponse.json({
      tx,
      approveAmount,
      approveTo,
      amountOut: amountOutRaw,
      amountOutHuman,
      priceImpact,
    });
  } catch (e) {
    const aborted = (e as Error).name === "AbortError";
    if (aborted) {
      return NextResponse.json({ error: "pendle_quote_timeout" }, { status: 504 });
    }
    console.error("[pendle-quote] error:", (e as Error).message);
    return NextResponse.json({ error: "pendle_quote_failed" }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
