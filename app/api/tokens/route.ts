import { apiError } from "@/lib/api/apiError";
import { rateLimit } from "@/lib/api/rateLimit";
import { fiatOf, isAllowedStable } from "@/lib/desks/stablecoins";
import type { FxToken } from "@/lib/fx-provider/core/types";
import { FxApiError, fxClient } from "@/lib/fx-provider/server-client";
import { type NextRequest, NextResponse } from "next/server";

// Token universe = curated mainnet stablecoins (verified addresses from LiFi)
// ∪ The FX provider's tokens (regional FX stables). "Mainly LiFi, some FX provider tokens."
export const revalidate = 60;

interface MergedToken extends FxToken {
  sources: ("fx-provider" | "lifi")[];
}

interface LifiToken {
  address: string;
  symbol: string;
  name?: string;
  decimals: number;
  verificationStatus?: string;
}

async function fetchLifiStables(): Promise<LifiToken[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch("https://li.quest/v1/tokens?chains=1", {
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { tokens?: { "1"?: LifiToken[] } };
    const all = data.tokens?.["1"] ?? [];
    // Filter to the allowlist; dedupe by symbol, preferring verified entries.
    const bySymbol = new Map<string, LifiToken>();
    for (const t of all) {
      if (!isAllowedStable(t.symbol)) continue;
      const cur = bySymbol.get(t.symbol);
      if (!cur || (t.verificationStatus === "verified" && cur.verificationStatus !== "verified")) {
        bySymbol.set(t.symbol, t);
      }
    }
    return [...bySymbol.values()];
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { name: "tokens", limit: 120, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const [{ tokens: fxProviderTokens }, lifiStables] = await Promise.all([
      fxClient.getTokens(),
      fetchLifiStables(),
    ]);

    const byAddr = new Map<string, MergedToken>();

    // LiFi stablecoins first (the broad base).
    for (const t of lifiStables) {
      const key = t.address.toLowerCase();
      byAddr.set(key, {
        address: key,
        symbol: t.symbol,
        name: t.name,
        decimals: t.decimals,
        currency: fiatOf(t.symbol),
        sources: ["lifi"],
      });
    }

    // FX provider tokens: add or mark dual-source.
    for (const t of fxProviderTokens) {
      const key = t.address.toLowerCase();
      const existing = byAddr.get(key);
      if (existing) {
        if (!existing.sources.includes("fx-provider")) existing.sources.push("fx-provider");
      } else {
        byAddr.set(key, {
          ...t,
          address: key,
          currency: t.currency ?? t.fiat_currency ?? fiatOf(t.symbol),
          sources: ["fx-provider"],
        });
      }
    }

    return NextResponse.json({ tokens: [...byAddr.values()] });
  } catch (e) {
    const status = e instanceof FxApiError ? e.status : 500;
    console.error("[tokens] upstream error:", (e as Error).message);
    return apiError("upstream_error", status);
  }
}
