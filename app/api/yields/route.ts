import { rateLimit } from "@/lib/api/rateLimit";
import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 120;

// DeFiLlama yields aggregator — single source for ALL stablecoin yield across
// Aave, Curve, Pendle, Fluid, GMX, Hyperliquid, Beefy, Yearn, etc. No auth.
// We filter to mainnet ETH + stablecoin flag + min TVL so the UI shows real
// pools, not dust. Sorted by APY descending. Verified 2026-05-31: 276 ETH
// stable pools at TVL >= $5M; top APYs from Pendle / Fluid / Mainstreet.
const LLAMA = "https://yields.llama.fi/pools";
const MIN_TVL = 1_000_000;
const TIMEOUT_MS = 9000;

// Reference rates (BUILD_PLAN § 5.1). Refresh quarterly — these are slow-moving.
const USD_TBILL_3M_PCT = 3.69;

// Project tier (BUILD_PLAN § 5.2). A = blue-chip audited, B = strong, C = default.
const TIER_A = new Set([
  "aave-v3",
  "compound-v3",
  "makerdao",
  "curve-dex",
  "sky",
  "ethena",
  "lido",
  "makerdao-rwa",
]);
const TIER_B = new Set([
  "morpho-blue",
  "fluid-lending",
  "pendle",
  "uniswap-v3",
  "uniswap-v4",
  "balancer-v3",
  "frax",
  "gauntlet",
  "steakhouse-financial",
]);

function projectTier(p: string): "A" | "B" | "C" {
  if (TIER_A.has(p)) return "A";
  if (TIER_B.has(p)) return "B";
  return "C";
}

// Map DeFiLlama project name → our yield-type taxonomy (NAV / Lending / Native / LP / Gov).
function yieldType(project: string): "NAV" | "Lending" | "Native" | "LP" | "Gov" {
  const p = project.toLowerCase();
  if (p === "pendle" || p.includes("yearn") || p.includes("steakhouse") || p === "ethena")
    return "NAV";
  if (
    p.includes("lending") ||
    p.startsWith("aave") ||
    p.startsWith("compound") ||
    p.startsWith("morpho") ||
    p.startsWith("fluid") ||
    p.startsWith("spark")
  )
    return "Lending";
  if (p.startsWith("sky") || p === "makerdao" || p.includes("savings")) return "Native";
  if (
    p.startsWith("curve") ||
    p.startsWith("uniswap") ||
    p.startsWith("balancer") ||
    p.startsWith("aerodrome") ||
    p.startsWith("velodrome")
  )
    return "LP";
  if (p.includes("ghost") || p.includes("dao") || p.includes("gov")) return "Gov";
  return "NAV";
}

function sdys(p: {
  apy: number;
  apyReward: number | null;
  tvlUsd: number;
  project: string;
  ilRisk: string;
}): number {
  const excess = Math.max(0, p.apy - USD_TBILL_3M_PCT);
  const excessPts = Math.min(1, excess / 8) * 45;
  const tvlPts = (Math.min(3, Math.max(0, Math.log10(p.tvlUsd || 1) - 6)) / 3) * 25;
  const tier = projectTier(p.project);
  const tierPts = { A: 20, B: 12, C: 6 }[tier];
  const ilPenalty = p.ilRisk === "yes" ? 10 : 0;
  const rewardShare = p.apyReward && p.apy > 0 ? Math.min(1, p.apyReward / p.apy) : 0;
  const rewardPen = rewardShare * rewardShare * 15;
  return Math.round(
    Math.max(0, Math.min(100, excessPts + tvlPts + tierPts - ilPenalty - rewardPen)),
  );
}

interface LlamaPool {
  pool: string;
  project: string;
  symbol: string;
  chain: string;
  tvlUsd: number | null;
  apy: number | null;
  apyBase: number | null;
  apyReward: number | null;
  stablecoin: boolean;
  ilRisk: string;
  exposure: string;
  underlyingTokens?: string[];
  url?: string;
}

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { name: "yields", limit: 30, windowMs: 60_000 });
  if (limited) return limited;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(LLAMA, { signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) return NextResponse.json({ error: `DeFiLlama ${res.status}` }, { status: 502 });
    const json = (await res.json()) as { data?: LlamaPool[] };
    const all = json.data ?? [];
    const filtered = all
      .filter(
        (p) =>
          p.stablecoin === true &&
          p.chain === "Ethereum" &&
          (p.tvlUsd ?? 0) >= MIN_TVL &&
          p.apy != null &&
          p.apy > 0 &&
          p.apy < 200 && // strip outliers / mispriced
          !["yearn-galaxy-finance"].includes(p.project),
      )
      .sort((a, b) => (b.apy ?? 0) - (a.apy ?? 0))
      .slice(0, 80);
    const scoredPools = filtered
      .map((p) => {
        const tier = projectTier(p.project);
        const yt = yieldType(p.project);
        const excessBps = Math.round(((p.apy ?? 0) - USD_TBILL_3M_PCT) * 100);
        const score = sdys({
          apy: p.apy ?? 0,
          apyReward: p.apyReward,
          tvlUsd: p.tvlUsd ?? 0,
          project: p.project,
          ilRisk: p.ilRisk,
        });
        return {
          id: p.pool,
          project: p.project,
          symbol: p.symbol,
          chain: p.chain,
          tvlUsd: p.tvlUsd,
          apy: p.apy,
          apyBase: p.apyBase,
          apyReward: p.apyReward,
          ilRisk: p.ilRisk,
          exposure: p.exposure,
          tier,
          yieldType: yt,
          excessBps,
          score,
        };
      })
      // Explicit server-side contract: never return pools with non-finite score.
      .filter((p) => Number.isFinite(p.score));
    return NextResponse.json({
      benchmark: { code: "USD-3M-T-Bill", rate: USD_TBILL_3M_PCT },
      pools: scoredPools,
    });
  } catch (e) {
    const aborted = (e as Error).name === "AbortError";
    return NextResponse.json(
      { error: aborted ? "DeFiLlama timed out" : `DeFiLlama failed: ${(e as Error).message}` },
      { status: 502 },
    );
  } finally {
    clearTimeout(timer);
  }
}
