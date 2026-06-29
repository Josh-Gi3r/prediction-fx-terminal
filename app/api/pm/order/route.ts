/**
 * POST /api/pm/order
 *
 * Validates the market and returns the token/tick/negRisk params needed
 * for the client to build an order with ClobClient.createOrder().
 *
 * The client does all signing and submission directly to the CLOB.
 * This route is purely a registry lookup + input validation gate.
 *
 * Body: { marketKey: string, side: "yes" | "no" }
 * Returns: { tokenId, tickSize, negRisk, minOrderSize }
 *
 * 403 when NEXT_PUBLIC_FEATURE_PM_BETTING is not "true".
 */

import { rateLimit } from "@/lib/api/rateLimit";
import { parseJsonBody } from "@/lib/api/validate";
import { marketByKey } from "@/lib/wc2026/pm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const PmOrderSchema = z.object({
  marketKey: z.string().trim().min(1),
  side: z.enum(["yes", "no"]),
});

/**
 * Valid tick sizes per the Polymarket SDK ROUNDING_CONFIG.
 * Guard here so a misconfigured registry entry never reaches the browser SDK
 * where an invalid value would silently corrupt order amounts.
 */
const VALID_TICK_SIZES = new Set(["0.1", "0.01", "0.001", "0.0001"]);

export async function POST(req: NextRequest) {
  if (process.env.NEXT_PUBLIC_FEATURE_PM_BETTING !== "true") {
    return NextResponse.json({ error: "Betting is not enabled" }, { status: 403 });
  }

  const limited = rateLimit(req, { name: "pm/order", limit: 20, windowMs: 60_000 });
  if (limited) return limited;

  const parsed = await parseJsonBody(req, PmOrderSchema, { tag: "pm/order" });
  if (!parsed.ok) return parsed.res;
  const { marketKey, side } = parsed.data;

  const market = marketByKey(marketKey);
  if (!market || !market.visible) {
    return NextResponse.json({ error: "Market not found" }, { status: 404 });
  }

  if (!market.acceptingOrders) {
    return NextResponse.json({ error: "Market not accepting orders" }, { status: 400 });
  }

  const tickSize = String(market.tickSize);
  if (!VALID_TICK_SIZES.has(tickSize)) {
    return NextResponse.json(
      { error: `Invalid tickSize "${tickSize}" in registry. Contact support.` },
      { status: 500 },
    );
  }

  const tokenId = side === "yes" ? market.yesTokenId : market.noTokenId;

  return NextResponse.json({
    tokenId,
    tickSize,
    negRisk: market.negRisk ?? false,
    minOrderSize: market.minOrderSize,
  });
}
