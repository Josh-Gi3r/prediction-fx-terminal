import { rateLimit } from "@/lib/api/rateLimit";
import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Live FX vaults (protocol "rate managers") from the public indexer.
 * Server-side so the indexer host never appears in client traffic; numbers
 * normalized once here (USDC 6dp, PNL cents, fee 1e18). Names are displayed
 * as-is except the rail's own brand prefix, which is stripped (white-label).
 */
const INDEXER = "https://indexer.zkp2p.xyz/v1/graphql";

const QUERY = `
query RateManagers {
  RateManager(limit: 50) {
    id chainId rateManagerAddress rateManagerId manager feeRecipient
    maxFee fee minLiquidity name uri createdAt updatedAt
  }
  ManagerAggregateStats(limit: 50) {
    id totalFilledVolume totalFeeAmount totalPnlUsdCents fulfilledIntents
    currentDelegatedBalance currentDelegatedDeposits
  }
}`;

export interface P2pVault {
  id: string;
  name: string;
  uri: string | null;
  feePct: number;
  delegatedUsdc: number;
  volumeUsdc: number;
  pnlUsd: number;
  orders: number;
  deposits: number;
  /** On-chain rate manager address (for setRateManager delegation). */
  rateManagerAddress: string | null;
  /** On-chain rate manager ID (hex, for setRateManager delegation). */
  rateManagerId: string;
}

function displayName(raw: string): string {
  // White-label: drop the rail's brand from vault names (PeerBOOST → BOOST).
  return raw.replace(/peer/gi, "").trim() || raw;
}

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { name: "p2p/vaults", limit: 30, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const res = await fetch(INDEXER, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: QUERY }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return NextResponse.json({ error: `indexer ${res.status}` }, { status: 502 });
    const { data } = (await res.json()) as {
      data?: {
        RateManager?: Array<Record<string, string | number | null>>;
        ManagerAggregateStats?: Array<Record<string, string | number | null>>;
      };
    };
    const aggById = new Map((data?.ManagerAggregateStats ?? []).map((a) => [String(a.id), a]));
    const seen = new Set<string>();
    const vaults: P2pVault[] = [];
    for (const m of data?.RateManager ?? []) {
      const name = String(m.name ?? "").trim();
      if (!name || seen.has(name)) continue; // dedupe re-registrations
      seen.add(name);
      const a = aggById.get(String(m.id)) ?? {};
      vaults.push({
        id: String(m.id),
        name: displayName(name),
        uri: m.uri ? String(m.uri) : null,
        feePct: Number(m.fee ?? 0) / 1e16,
        delegatedUsdc: Number(a.currentDelegatedBalance ?? 0) / 1e6,
        volumeUsdc: Number(a.totalFilledVolume ?? 0) / 1e6,
        pnlUsd: Number(a.totalPnlUsdCents ?? 0) / 100,
        orders: Number(a.fulfilledIntents ?? 0),
        deposits: Number(a.currentDelegatedDeposits ?? 0),
        rateManagerAddress: m.rateManagerAddress ? String(m.rateManagerAddress) : null,
        rateManagerId: String(m.rateManagerId ?? m.id ?? ""),
      });
    }
    vaults.sort((x, y) => y.volumeUsdc - x.volumeUsdc);
    return NextResponse.json(
      { vaults, fetchedAt: new Date().toISOString() },
      { headers: { "cache-control": "public, s-maxage=120, stale-while-revalidate=300" } },
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "fetch failed" },
      { status: 502 },
    );
  }
}
