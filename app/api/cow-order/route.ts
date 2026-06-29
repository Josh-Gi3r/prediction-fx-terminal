import { rateLimit } from "@/lib/api/rateLimit";
import { parseJsonBody, zAddress, zHex, zRawAmount } from "@/lib/api/validate";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

// Posts a signed GPv2Order to CoW's orderbook. Keyless. Returns the orderUid;
// a solver fills it asynchronously in a batch auction (track on explorer.cow.fi).
// Verified live 2026-05-31: a fresh-key order posts past the signature gate
// (rejected only on InsufficientBalance), proving the GPv2Order signing is correct.
const COW_ORDERS = "https://api.cow.fi/mainnet/api/v1/orders";
const TIMEOUT_MS = 12_000;

// CoW GPv2Order envelope — required fields the route uses to gate requests.
// Additional fields (kind, validTo, partiallyFillable, etc.) are passed through
// to the CoW API verbatim.
const CowOrderSchema = z
  .object({
    signature: zHex,
    from: zAddress,
    sellToken: zAddress,
    buyToken: zAddress,
    sellAmount: zRawAmount,
    buyAmount: zRawAmount,
  })
  .passthrough(); // CoW requires additional GPv2 fields; forward them as-is.

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { name: "cow-order", limit: 20, windowMs: 60_000 });
  if (limited) return limited;

  const parsed = await parseJsonBody(req, CowOrderSchema, { tag: "cow-order" });
  if (!parsed.ok) return parsed.res;
  const body = parsed.data;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(COW_ORDERS, {
      method: "POST",
      signal: ctrl.signal,
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const d = data as { errorType?: string; description?: string };
      return NextResponse.json(
        { error: d.description ?? d.errorType ?? `CoW ${res.status}` },
        { status: 200 },
      );
    }
    // Success: data is the orderUid string.
    return NextResponse.json({ orderUid: typeof data === "string" ? data : data });
  } catch (e) {
    const aborted = (e as Error).name === "AbortError";
    return NextResponse.json(
      { error: aborted ? "CoW order timed out" : `CoW order failed: ${(e as Error).message}` },
      { status: 200 },
    );
  } finally {
    clearTimeout(timer);
  }
}
