import { rateLimit } from "@/lib/api/rateLimit";
import { parseQuery } from "@/lib/api/validate";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

// GET /api/cow-status?order_uid=<uid>
//
// Polls GET https://api.cow.fi/mainnet/api/v1/orders/{uid}
// Terminal statuses: "fulfilled" | "expired" | "cancelled".
// Pending statuses: "open" | "presignaturePending".
const COW_BASE = "https://api.cow.fi/mainnet/api/v1";
const TIMEOUT_MS = 8_000;

// CoW order UIDs are 0x-prefixed 112-char hex strings (56 bytes: orderDigest
// 32B + owner 20B + validTo 4B). Accept 0x + 2–256 hex chars (loose enough
// to survive any future format changes).
const CowStatusSchema = z.object({
  order_uid: z.string().regex(/^0x[0-9a-fA-F]{2,256}$/, "invalid order_uid"),
});

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { name: "cow-status", limit: 120, windowMs: 60_000 });
  if (limited) return limited;

  const qResult = parseQuery(req, CowStatusSchema, { tag: "cow-status" });
  if (!qResult.ok) return qResult.res;
  const { order_uid: orderUid } = qResult.data;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${COW_BASE}/orders/${encodeURIComponent(orderUid)}`, {
      signal: ctrl.signal,
      cache: "no-store",
    });

    if (!res.ok) {
      // 404 = order not yet indexed by CoW; still pending.
      if (res.status === 404) {
        return NextResponse.json({ terminal: false, fulfilled: false, status: "open" });
      }
      return NextResponse.json({ error: "cow_upstream_error" }, { status: res.status });
    }

    const order = (await res.json()) as {
      status?: string;
      executedBuyAmount?: string;
      executedSellAmount?: string;
      txHash?: string | null;
    };

    const status = order.status ?? "open";
    const fulfilled = status === "fulfilled";
    const failed = status === "expired" || status === "cancelled";
    const terminal = fulfilled || failed;

    return NextResponse.json({
      terminal,
      fulfilled,
      failed,
      status,
      executed_buy_amount: order.executedBuyAmount ?? null,
      tx_hash: order.txHash ?? null,
    });
  } catch (e) {
    const aborted = (e as Error).name === "AbortError";
    if (aborted) {
      return NextResponse.json({ error: "cow_status_timeout" }, { status: 504 });
    }
    console.error("[cow-status] upstream error:", (e as Error).message);
    return NextResponse.json({ error: "upstream_error" }, { status: 500 });
  } finally {
    clearTimeout(timer);
  }
}
