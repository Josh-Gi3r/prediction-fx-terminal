import { rateLimit } from "@/lib/api/rateLimit";
import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 60;

// Perp DEX LP vaults — stablecoin LPs as counterparty to leveraged traders.
// Hyperliquid HLP + top GMX v2 GM pools. Both keyless.
const HLP_ADDR = "0xdfc24b077bc1425ad1dea75bcb6f8158e10df303";
const HL_INFO = "https://api.hyperliquid.xyz/info";
const GMX_APY = "https://arbitrum-api.gmxinfra.io/apy";
const GMX_MARKETS = "https://arbitrum-api.gmxinfra.io/markets";
const USDC_ARB = "0xaf88d065e77c8cc2239327c5edb3a432268e5831";
const TIMEOUT_MS = 8000;

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { ...init, signal: ctrl.signal, cache: "no-store" });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

interface HlpDetails {
  name?: string;
  vaultAddress?: string;
  apr?: number;
  followers?: unknown[];
}

interface GmxMarket {
  name: string;
  marketToken: string;
  indexToken?: string;
  longToken?: string;
  shortToken?: string;
  isListed?: boolean;
}

interface GmxApyEntry {
  apy: number;
  baseApy?: number;
  bonusApr?: number;
}

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { name: "perp-vaults", limit: 30, windowMs: 60_000 });
  if (limited) return limited;

  const [hlp, gmxApy, gmxMarkets] = await Promise.all([
    fetchJson<HlpDetails>(HL_INFO, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "vaultDetails", vaultAddress: HLP_ADDR }),
    }),
    fetchJson<{ markets: Record<string, GmxApyEntry> }>(GMX_APY),
    fetchJson<{ markets: GmxMarket[] }>(GMX_MARKETS),
  ]);

  const hyperliquid = hlp
    ? {
        name: hlp.name ?? "Hyperliquidity Provider (HLP)",
        address: hlp.vaultAddress ?? HLP_ADDR,
        aprPct: typeof hlp.apr === "number" ? hlp.apr * 100 : null,
        followers: Array.isArray(hlp.followers) ? hlp.followers.length : undefined,
        url: `https://app.hyperliquid.xyz/vaults/${HLP_ADDR}`,
      }
    : null;

  let gmx: Array<{ name: string; marketToken: string; apyPct: number; url: string }> = [];
  if (gmxApy?.markets && gmxMarkets?.markets) {
    const byToken = new Map<string, GmxMarket>();
    for (const m of gmxMarkets.markets) byToken.set(m.marketToken.toLowerCase(), m);
    gmx = Object.entries(gmxApy.markets)
      .map(([token, entry]) => {
        const m = byToken.get(token.toLowerCase());
        return m && m.isListed !== false && entry?.apy != null
          ? {
              name: m.name,
              marketToken: token,
              apyPct: entry.apy * 100,
              shortToken: m.shortToken?.toLowerCase(),
            }
          : null;
      })
      .filter((x): x is NonNullable<typeof x> => !!x)
      // Stablecoin-paired (short = USDC) only — that's where stable LPs earn
      .filter((x) => x.shortToken === USDC_ARB.toLowerCase())
      .filter((x) => x.apyPct > 0.5 && x.apyPct < 100)
      .sort((a, b) => b.apyPct - a.apyPct)
      .slice(0, 6)
      .map((x) => ({
        name: x.name,
        marketToken: x.marketToken,
        apyPct: x.apyPct,
        url: `https://app.gmx.io/#/pools/${x.marketToken}`,
      }));
  }

  return NextResponse.json({ hyperliquid, gmx });
}
