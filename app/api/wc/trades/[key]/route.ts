import { rateLimit } from "@/lib/api/rateLimit";
import { PM_DATA, marketByKey } from "@/lib/wc2026/pm";
import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Accepted market key pattern: printable ASCII, no whitespace, 3–128 chars.
const KEY_RE = /^[\x21-\x7E]{3,128}$/;

/** GET /api/wc/trades/:key — recent real trades + holder count. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ key: string }> }) {
  const limited = rateLimit(req, { name: "wc/trades", limit: 30, windowMs: 60_000 });
  if (limited) return limited;

  const { key } = await ctx.params;

  if (!KEY_RE.test(key)) {
    return NextResponse.json({ error: "invalid market key" }, { status: 400 });
  }

  const m = marketByKey(key);
  if (!m || !m.visible) {
    return NextResponse.json({ error: "unknown or hidden market" }, { status: 404 });
  }
  const ua = { "user-agent": `${process.env.NEXT_PUBLIC_APP_NAME ?? "predfx"}/1.0` };
  const [tradesRes, holdersRes] = await Promise.all([
    fetch(`${PM_DATA}/trades?market=${m.conditionId}&limit=30`, {
      headers: ua,
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    }),
    fetch(`${PM_DATA}/holders?market=${m.conditionId}&limit=1`, {
      headers: ua,
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    }),
  ]);
  const trades = tradesRes.ok ? await tradesRes.json() : [];
  const holders = holdersRes.ok ? await holdersRes.json() : null;
  return NextResponse.json(
    { key, trades, holders },
    { headers: { "cache-control": "public, s-maxage=15, stale-while-revalidate=60" } },
  );
}
