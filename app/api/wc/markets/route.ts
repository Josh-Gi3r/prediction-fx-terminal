import { apiError } from "@/lib/api/apiError";
import { rateLimit } from "@/lib/api/rateLimit";
import {
  type PmRegistryMarket,
  marketByKey,
  passesGate,
  refreshLive,
  registryBuiltAt,
  registryMarketCount,
  visibleMarkets,
} from "@/lib/wc2026/pm";
import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/wc/markets?category=champion&team=MEX&group=A&limit=100&offset=0&key=wc:match:...
 *
 * Pagination params:
 *   limit   — page size, default 100, max 200
 *   offset  — zero-based row offset, default 0
 *   key     — exact market key lookup; returns single-item page, bypasses offset/limit
 *
 * Response shape:
 *   { builtAt, registryTotal, count: <total after filter+gate>, markets: <page> }
 *
 * count is the total number of live gate-passing markets for the current
 * filter — not just the page size. Callers can paginate with offset until
 * offset >= count.
 *
 * registryTotal is the raw count of all markets in pmRegistry.json (including
 * non-visible). An empty registry (registryTotal=0 AND builtAt="missing") means
 * the file is absent or was built with --allow-empty — monitoring should alert.
 *
 * Registry rows refreshed against live Gamma, with the liquidity gate
 * recomputed on LIVE numbers — a market that thinned out since the nightly
 * build drops off here. The frontend never receives a thin book.
 */
export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { name: "wc/markets", limit: 30, windowMs: 60_000 });
  if (limited) return limited;

  try {
    return await handle(req);
  } catch (err) {
    console.error("[wc/markets] internal error:", err instanceof Error ? err.message : String(err));
    return apiError("internal_error", 500);
  }
}

async function handle(req: NextRequest) {
  const sp = req.nextUrl.searchParams;

  // Pagination
  const limitParam = Math.min(Math.max(1, Number(sp.get("limit") ?? 100) || 100), 200);
  const offsetParam = Math.max(0, Number(sp.get("offset") ?? 0) || 0);

  // Exact-key lookup: short-circuit to a single market, skips offset/limit.
  const keyParam = sp.get("key");
  if (keyParam) {
    const reg = marketByKey(keyParam);
    if (!reg) {
      // Unknown key — return empty page (count = 0) rather than 404 so callers
      // can handle gracefully without special-casing the status code.
      return NextResponse.json(
        { builtAt: registryBuiltAt(), registryTotal: registryMarketCount(), count: 0, markets: [] },
        { headers: { "cache-control": "public, s-maxage=20, stale-while-revalidate=60" } },
      );
    }
    const live = await refreshLive([reg.conditionId]);
    const l = live.get(reg.conditionId);
    if (!l || !passesGate(l)) {
      return NextResponse.json(
        { builtAt: registryBuiltAt(), registryTotal: registryMarketCount(), count: 0, markets: [] },
        { headers: { "cache-control": "public, s-maxage=20, stale-while-revalidate=60" } },
      );
    }
    const market = buildMarket(reg, l);
    return NextResponse.json(
      {
        builtAt: registryBuiltAt(),
        registryTotal: registryMarketCount(),
        count: 1,
        markets: [market],
      },
      { headers: { "cache-control": "public, s-maxage=20, stale-while-revalidate=60" } },
    );
  }

  // Normal flow: filter registry, refresh live, paginate.
  const rows = visibleMarkets({
    category: sp.get("category") ?? undefined,
    teamCode: sp.get("team") ?? undefined,
    groupId: sp.get("group") ?? undefined,
  });

  const live = await refreshLive(rows.map((r) => r.conditionId));

  const allMarkets = rows
    .map((r) => {
      const l = live.get(r.conditionId);
      if (!l) {
        // Gamma unreachable for this chunk — fall back to the build snapshot
        // (already gate-passing) rather than blanking the page.
        return buildSnapshotMarket(r);
      }
      if (!passesGate(l)) return null; // thinned out since build → hidden
      return buildMarket(r, l);
    })
    .filter((m): m is NonNullable<typeof m> => m !== null);

  const count = allMarkets.length;
  const markets = allMarkets.slice(offsetParam, offsetParam + limitParam);

  return NextResponse.json(
    { builtAt: registryBuiltAt(), registryTotal: registryMarketCount(), count, markets },
    { headers: { "cache-control": "public, s-maxage=20, stale-while-revalidate=60" } },
  );
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function buildMarket(
  r: PmRegistryMarket,
  l: {
    yesPrice: number | null;
    noPrice: number | null;
    volume: number;
    liquidity: number;
    bestBid: number;
    bestAsk: number;
    acceptingOrders: boolean;
  },
) {
  return {
    key: r.key,
    category: r.category,
    eventTitle: r.eventTitle,
    outcomeLabel: r.outcomeLabel || null,
    eventSlug: r.eventSlug,
    icon: r.icon,
    question: r.question,
    teamCode: r.teamCode,
    teamName: r.teamName,
    groupId: r.groupId,
    negRisk: r.negRisk,
    tickSize: r.tickSize,
    minOrderSize: r.minOrderSize,
    yesPrice: l.yesPrice,
    noPrice: l.noPrice,
    volume: l.volume,
    liquidity: l.liquidity,
    bestBid: l.bestBid,
    bestAsk: l.bestAsk,
    live: true,
  };
}

function buildSnapshotMarket(r: PmRegistryMarket) {
  return {
    key: r.key,
    category: r.category,
    eventTitle: r.eventTitle,
    outcomeLabel: r.outcomeLabel || null,
    eventSlug: r.eventSlug,
    icon: r.icon,
    question: r.question,
    teamCode: r.teamCode,
    teamName: r.teamName,
    groupId: r.groupId,
    negRisk: r.negRisk,
    tickSize: r.tickSize,
    minOrderSize: r.minOrderSize,
    yesPrice: r.snapshot.yesPrice ? Number(r.snapshot.yesPrice) : null,
    noPrice: null,
    volume: r.snapshot.volume,
    liquidity: r.snapshot.liquidity,
    bestBid: r.snapshot.bestBid,
    bestAsk: r.snapshot.bestAsk,
    live: false,
  };
}
