import { rateLimit } from "@/lib/api/rateLimit";
import { getCurrencyCodeFromHash, getPaymentMethodsCatalog } from "@zkp2p/sdk";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Vault detail — daily snapshots + rate manager detail for a single vault.
 * All indexer traffic stays server-side (white-label). Units normalised here:
 *   - USDC amounts: raw 6dp → divide by 1e6
 *   - PNL: cents → divide by 100
 *   - TVL: raw 6dp → divide by 1e6
 *   - dayTimestamp: unix seconds (string) → kept as number
 */

const INDEXER = "https://indexer.zkp2p.xyz/v1/graphql";

// Vault id is chainId_address_rateManagerId or bare rateManagerId.
// Accept hex chars, digits, underscores and hyphens, up to 200 chars.
const VAULT_ID_RE = /^[0-9a-fA-F_\-x]{1,200}$/;

const SNAPSHOTS_QUERY = `
query ManagerDailySnapshots($rateManagerId: String!, $rateManagerAddress: String) {
  ManagerDailySnapshot(
    where: {
      rateManagerId: { _eq: $rateManagerId }
      ${/* rateManagerAddress filter handled optionally below */ ""}
    }
    order_by: { dayTimestamp: asc }
    limit: 90
  ) {
    dayTimestamp tvl delegatedDeposits dailyVolume dailyFees
    dailyPnlUsdCents dailyFulfilledIntents
    cumulativeVolume cumulativePnlUsdCents
  }
}`;

// Also fetch manual rate updates for the rates table
const RATES_QUERY = `
query ManualRateUpdates($rateManagerId: String!) {
  RateManagerV1_RateManagerRateUpdated(
    where: { rateManagerId: { _eq: $rateManagerId } }
    order_by: { id: desc }
    limit: 200
  ) {
    id rateManagerId paymentMethod currencyCode rate
  }
}`;

export interface DailySnapshotRow {
  dayTimestamp: number;
  tvl: number;
  delegatedDeposits: number;
  dailyVolume: number;
  dailyFees: number;
  dailyPnlUsd: number;
  dailyOrders: number;
  cumulativeVolume: number;
  cumulativePnlUsd: number;
}

export interface VaultRateRow {
  paymentMethod: string;
  currency: string;
  vaultRate: number | null; // rate as fiat-per-USDC (1e18 → divide) or null
  minRate: number | null;
}

export interface VaultDetailResponse {
  snapshots: DailySnapshotRow[];
  rates: VaultRateRow[];
  apr7d: number | null;
  fetchedAt: string;
}

async function gql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(INDEXER, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`indexer ${res.status}`);
  const json = (await res.json()) as { data?: T; errors?: unknown[] };
  if (json.errors?.length) throw new Error(JSON.stringify(json.errors[0]));
  if (!json.data) throw new Error("no data");
  return json.data;
}

function calcApr7d(rows: DailySnapshotRow[]): number | null {
  const last7 = rows.slice(-7);
  if (last7.length === 0) return null;
  const pnlSum = last7.reduce((s, r) => s + r.dailyPnlUsd, 0);
  const tvlVals = last7.map((r) => r.tvl).filter((v) => v > 0);
  if (tvlVals.length === 0) return null;
  const avgTvl = tvlVals.reduce((s, v) => s + v, 0) / tvlVals.length;
  if (avgTvl === 0) return null;
  return (pnlSum / avgTvl) * 52;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, { name: "p2p/vaults/id", limit: 30, windowMs: 60_000 });
  if (limited) return limited;

  const { id } = await params;

  if (!VAULT_ID_RE.test(id)) {
    return NextResponse.json({ error: "invalid vault id" }, { status: 400 });
  }

  // The list id is a composite `chainId_rateManagerAddress_rateManagerId`;
  // indexer rows key on the bare rateManagerId (last segment).
  const rateManagerId = id.includes("_") ? (id.split("_").pop() as string) : id;

  try {
    // Snapshots and rates fetched in parallel
    const [snapshotsData, ratesData] = await Promise.all([
      gql<{
        ManagerDailySnapshot: Array<Record<string, string | number | null>>;
      }>(SNAPSHOTS_QUERY, { rateManagerId }),
      gql<{
        RateManagerV1_RateManagerRateUpdated: Array<Record<string, string | number | null>>;
      }>(RATES_QUERY, { rateManagerId }).catch(() => ({
        RateManagerV1_RateManagerRateUpdated: [] as Array<Record<string, string | number | null>>,
      })),
    ]);

    const snapshots: DailySnapshotRow[] = (snapshotsData.ManagerDailySnapshot ?? []).map((s) => ({
      dayTimestamp: Number(s.dayTimestamp ?? 0),
      tvl: Number(s.tvl ?? 0) / 1e6,
      delegatedDeposits: Number(s.delegatedDeposits ?? 0),
      dailyVolume: Number(s.dailyVolume ?? 0) / 1e6,
      dailyFees: Number(s.dailyFees ?? 0) / 1e6,
      dailyPnlUsd: Number(s.dailyPnlUsdCents ?? 0) / 100,
      dailyOrders: Number(s.dailyFulfilledIntents ?? 0),
      cumulativeVolume: Number(s.cumulativeVolume ?? 0) / 1e6,
      cumulativePnlUsd: Number(s.cumulativePnlUsdCents ?? 0) / 100,
    }));

    // Rates: dedupe by (paymentMethod, currency) — keep most-recent
    // hash → readable decoders (platform names + ISO currency codes)
    const methodByHash = new Map<string, string>();
    const catalog = getPaymentMethodsCatalog(8453) as unknown as Record<
      string,
      { paymentMethodHash?: string }
    >;
    for (const [name, info] of Object.entries(catalog)) {
      if (info?.paymentMethodHash) methodByHash.set(info.paymentMethodHash.toLowerCase(), name);
    }
    const rateMap = new Map<string, VaultRateRow>();
    for (const r of ratesData.RateManagerV1_RateManagerRateUpdated ?? []) {
      const methodHash = String(r.paymentMethod ?? "");
      const method = methodByHash.get(methodHash.toLowerCase()) ?? methodHash.slice(0, 10);
      const currencyHash = String(r.currencyCode ?? r.currency ?? "");
      const currency = getCurrencyCodeFromHash(currencyHash) ?? currencyHash.slice(0, 10);
      const key = `${method}:${currency}`;
      if (!rateMap.has(key)) {
        // rates are stored as 1e18 fixed-point in "rate" field
        const rawRate = r.rate != null ? Number(r.rate) : null;
        const rawMin = r.minRate != null ? Number(r.minRate) : null;
        rateMap.set(key, {
          paymentMethod: method,
          currency,
          vaultRate: rawRate && rawRate > 0 ? rawRate / 1e18 : null,
          minRate: rawMin && rawMin > 0 ? rawMin / 1e18 : null,
        });
      }
    }

    const rates = Array.from(rateMap.values()).sort((a, b) =>
      `${a.currency}${a.paymentMethod}`.localeCompare(`${b.currency}${b.paymentMethod}`),
    );

    const payload: VaultDetailResponse = {
      snapshots,
      rates,
      apr7d: calcApr7d(snapshots),
      fetchedAt: new Date().toISOString(),
    };

    return NextResponse.json(payload, {
      headers: { "cache-control": "public, max-age=120" },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "fetch failed" },
      { status: 502 },
    );
  }
}
