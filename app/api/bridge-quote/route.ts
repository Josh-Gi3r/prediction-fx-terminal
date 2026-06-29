/**
 * POST /api/bridge-quote
 *
 * Cross-chain bridge quote: Ethereum stables → Polygon USDC.e via LiFi.
 *
 * Used by FundWalletModal to fund a Polymarket betting wallet on Polygon.
 * Single venue (no ranking) — this is a funding flow, not a price comparison.
 *
 * Request:  { fromToken, fromAmountRaw, owner, gasOnDestination }
 * Response: { toAmountMin, approvalAddress, transactionRequest, executionSeconds,
 *             gasUsd, tool, gasDropNote? }
 *
 * Rate limit: 20 req/min per IP.
 */

import { apiError } from "@/lib/api/apiError";
import { rateLimit } from "@/lib/api/rateLimit";
import { parseJsonBody, zAddress, zRawAmount } from "@/lib/api/validate";
import { BRIDGE_SOURCE_TOKENS, fetchBridgeQuote } from "@/lib/bridge/quote";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const INTEGRATOR = process.env.NEXT_PUBLIC_LIFI_INTEGRATOR ?? "predfx-terminal";

const BridgeQuoteSchema = z.object({
  fromToken: zAddress,
  fromAmountRaw: zRawAmount.refine((v) => v !== "0", {
    message: "fromAmountRaw cannot be zero",
  }),
  owner: zAddress,
  gasOnDestination: z.boolean(),
});

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { name: "bridge-quote", limit: 20, windowMs: 60_000 });
  if (limited) return limited;

  const parsed = await parseJsonBody(req, BridgeQuoteSchema, { tag: "bridge-quote" });
  if (!parsed.ok) return parsed.res;
  const b = parsed.data;

  // Only accept known bridge-capable source tokens (USDC, USDT on Ethereum).
  if (!BRIDGE_SOURCE_TOKENS.has(b.fromToken.toLowerCase())) {
    return NextResponse.json(
      {
        error: "Unsupported source token. Use USDC or USDT on Ethereum.",
      },
      { status: 400 },
    );
  }

  const result = await fetchBridgeQuote(
    {
      fromToken: b.fromToken,
      fromAmountRaw: b.fromAmountRaw,
      owner: b.owner,
      gasOnDestination: b.gasOnDestination,
    },
    INTEGRATOR,
    process.env.LIFI_API_KEY,
  );

  if (!result.ok) {
    console.error("[bridge-quote] LiFi upstream error:", result.message);
    return apiError("bridge_quote_failed", 502);
  }

  return NextResponse.json(result.data);
}
