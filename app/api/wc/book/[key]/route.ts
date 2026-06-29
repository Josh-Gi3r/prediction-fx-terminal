import { rateLimit } from "@/lib/api/rateLimit";
import { PM_CLOB, marketByKey } from "@/lib/wc2026/pm";
import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Accepted market key pattern: printable ASCII, no whitespace, 3–128 chars.
const KEY_RE = /^[\x21-\x7E]{3,128}$/;

/**
 * GET /api/wc/book/:key — live Polymarket order book for the YES token.
 * Binary identity: a YES bid at p == a NO ask at 1−p, so the YES book
 * fully describes the market.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ key: string }> }) {
  const limited = rateLimit(req, { name: "wc/book", limit: 30, windowMs: 60_000 });
  if (limited) return limited;

  const { key } = await ctx.params;

  if (!KEY_RE.test(key)) {
    return NextResponse.json({ error: "invalid market key" }, { status: 400 });
  }

  const m = marketByKey(key);
  if (!m || !m.visible) {
    return NextResponse.json({ error: "unknown or hidden market" }, { status: 404 });
  }
  const res = await fetch(`${PM_CLOB}/book?token_id=${m.yesTokenId}`, {
    headers: { "user-agent": `${process.env.NEXT_PUBLIC_APP_NAME ?? "predfx"}/1.0` },
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) {
    return NextResponse.json({ error: `clob ${res.status}` }, { status: 502 });
  }
  const book = (await res.json()) as { bids?: unknown[]; asks?: unknown[] };
  return NextResponse.json(
    { key, question: m.question, ...book },
    { headers: { "cache-control": "public, s-maxage=5, stale-while-revalidate=15" } },
  );
}
