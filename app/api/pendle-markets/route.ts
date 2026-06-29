import { rateLimit } from "@/lib/api/rateLimit";
import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 180;

// Pendle V2 active markets on Ethereum mainnet — keyless v2 backend.
// Filtered to stablecoin-underlying PT markets so the Earn tab can surface
// in-app fixed-yield opportunities. Deposit flow uses PendleRouter; for now
// each row links out to app.pendle.finance/trade/{market}.
const PENDLE = "https://api-v2.pendle.finance/core/v1/1/markets/active";
const TIMEOUT_MS = 8000;

const STABLE_SYMBOLS = new Set([
  "USDC",
  "USDT",
  "DAI",
  "USDe",
  "sUSDe",
  "USDS",
  "sUSDS",
  "FRAX",
  "sFRAX",
  "GHO",
  "sGHO",
  "PYUSD",
  "USR",
  "sUSR",
  "USD0",
  "USD0++",
  "USDY",
  "BUIDL",
  "crvUSD",
  "scrvUSD",
  "RLUSD",
  "TUSD",
  "FDUSD",
  "USDP",
  "LUSD",
  "USDX",
  "deUSD",
  "sdeUSD",
  "USDV",
  "AUSD",
]);

interface PendleMarket {
  name: string;
  address: string;
  expiry: string;
  pt: string;
  yt: string;
  underlyingAsset: string;
  details?: {
    liquidity?: number;
    pendleApy?: number;
    impliedApy?: number;
    ytFloatingApy?: number;
    feeRate?: number;
  };
}

function symbolFromName(name: string): string | null {
  // Pendle market names look like "wstETH", "sUSDe", "PT-USDC-30Jun2025", "USDe", etc.
  const m = name.match(/^([A-Za-z0-9]+)/);
  return m?.[1] ?? null;
}

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { name: "pendle-markets", limit: 120, windowMs: 60_000 });
  if (limited) return limited;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(PENDLE, { signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) {
      console.error("[pendle-markets] Pendle upstream error:", res.status);
      return NextResponse.json({ error: "upstream_error" }, { status: 502 });
    }
    const json = (await res.json()) as { markets?: PendleMarket[] };
    const all = json.markets ?? [];
    const filtered = all
      .filter((m) => {
        const sym = symbolFromName(m.name);
        return sym && STABLE_SYMBOLS.has(sym);
      })
      .filter((m) => (m.details?.liquidity ?? 0) >= 100_000)
      .filter((m) => (m.details?.impliedApy ?? 0) > 0.005 && (m.details?.impliedApy ?? 0) < 1)
      .map((m) => ({
        name: m.name,
        symbol: symbolFromName(m.name),
        marketAddress: m.address,
        ptAddress: m.pt.split("-")[1] ?? m.pt,
        expiry: m.expiry,
        impliedApyPct: (m.details?.impliedApy ?? 0) * 100,
        liquidityUsd: m.details?.liquidity ?? 0,
        ytFloatingApyPct: (m.details?.ytFloatingApy ?? 0) * 100,
        url: `https://app.pendle.finance/trade/markets/${m.address}`,
      }))
      .sort((a, b) => b.impliedApyPct - a.impliedApyPct)
      .slice(0, 12);
    return NextResponse.json({ markets: filtered });
  } catch (e) {
    const aborted = (e as Error).name === "AbortError";
    if (aborted) {
      return NextResponse.json({ error: "pendle_timeout" }, { status: 504 });
    }
    console.error("[pendle-markets] error:", (e as Error).message);
    return NextResponse.json({ error: "upstream_error" }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
