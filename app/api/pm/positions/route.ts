/**
 * GET /api/pm/positions?address=0x...
 *
 * Server proxy for Polymarket Data API positions. Avoids CORS and keeps
 * the Data API endpoint flexible to change. Returns normalized positions
 * for the connected wallet's Polygon address.
 *
 * Settlement note (doc §6): positions are CTF outcome tokens held directly
 * in the user's wallet. This app never touches them. Winnings settle on-chain
 * to the user's address when the market resolves.
 */

import { rateLimit } from "@/lib/api/rateLimit";
import { parseQuery, zAddress } from "@/lib/api/validate";
import { PM_DATA, visibleMarkets } from "@/lib/wc2026/pm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

interface DataApiPosition {
  condition_id?: string;
  market?: string;
  title?: string;
  outcome?: string;
  size?: number;
  avgPrice?: number | null;
  curPrice?: number | null;
  resolved?: boolean;
  winner?: string | null;
}

const PositionsSchema = z.object({
  address: zAddress,
});

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { name: "pm/positions", limit: 120, windowMs: 60_000 });
  if (limited) return limited;

  const qResult = parseQuery(req, PositionsSchema, { tag: "pm/positions" });
  if (!qResult.ok) return qResult.res;
  const { address } = qResult.data;

  try {
    // Fetch from Data API — positions endpoint
    const res = await fetch(`${PM_DATA}/positions?user=${address}&sizeThreshold=0.01`, {
      headers: { "user-agent": `${process.env.NEXT_PUBLIC_APP_NAME ?? "predfx"}/1.0` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      // Data API may 404 for wallets with no positions — treat as empty
      if (res.status === 404) {
        return NextResponse.json({ positions: [] });
      }
      console.error("[pm/positions] Data API upstream error:", res.status);
      return NextResponse.json({ error: "upstream_error" }, { status: 502 });
    }

    const raw = (await res.json()) as DataApiPosition[] | { data?: DataApiPosition[] };
    const items: DataApiPosition[] = Array.isArray(raw) ? raw : (raw.data ?? []);

    // Build a conditionId→market map for enrichment from our registry
    const registryMarkets = visibleMarkets();
    const conditionMap = new Map(registryMarkets.map((m) => [m.conditionId, m]));

    const positions = items
      .map((p) => {
        const conditionId = p.condition_id ?? p.market ?? "";
        const registryEntry = conditionMap.get(conditionId);
        return {
          conditionId,
          title: p.title ?? registryEntry?.question ?? conditionId.slice(0, 20),
          outcome: p.outcome ?? "YES",
          size: Number(p.size ?? 0),
          avgPrice: p.avgPrice != null ? Number(p.avgPrice) : null,
          currentPrice: p.curPrice != null ? Number(p.curPrice) : null,
          resolved: Boolean(p.resolved),
          winner: p.winner ?? null,
        };
      })
      .filter((p) => p.size > 0);

    return NextResponse.json({ positions });
  } catch (err) {
    console.error("[pm/positions] error:", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "upstream_error" }, { status: 500 });
  }
}
