"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { erc20Abi } from "viem";
import { useReadContracts } from "wagmi";
import { toRaw } from "../fx-provider/core/format";
import type { FxConfig, FxToken } from "../fx-provider/core/types";
import type { NormalizedQuote, QuoteResult } from "./source";

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? res.statusText);
  return res.json();
}

export function useConfig() {
  return useQuery({
    queryKey: ["config"],
    queryFn: () => getJSON<FxConfig>("/api/config"),
    staleTime: 5 * 60_000,
  });
}

export interface Capabilities {
  fxSettlement: boolean;
  fxDeposit: boolean;
}

/** Server capability flags — whether FX_PROVIDER_API_KEY/FX_PROVIDER_API_SECRET are set.
 *  Defaults to enabled (true) while loading so the UI never flashes degraded state. */
export function useCapabilities() {
  return useQuery<Capabilities>({
    queryKey: ["capabilities"],
    queryFn: () => getJSON<Capabilities>("/api/capabilities"),
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
    placeholderData: { fxSettlement: true, fxDeposit: true },
  });
}

export function useTokens() {
  return useQuery({
    queryKey: ["tokens"],
    queryFn: async () => (await getJSON<{ tokens: FxToken[] }>("/api/tokens")).tokens,
    staleTime: 5 * 60_000,
  });
}

/** Wallet balances read on-chain (keyless) via Multicall3. Returns symbol -> raw
 * uint256 string. The FX provider's /balances endpoint needs an API key; on-chain reads
 * don't, and match the non-custodial model. */
export function useWalletBalances(owner?: string, tokens?: FxToken[]) {
  const list = tokens ?? [];
  const { data, isLoading } = useReadContracts({
    allowFailure: true,
    contracts: list.map((t) => ({
      address: t.address as `0x${string}`,
      abi: erc20Abi,
      functionName: "balanceOf" as const,
      args: [owner as `0x${string}`],
    })),
    query: { enabled: !!owner && list.length > 0, refetchInterval: 20_000 },
  });

  const balances = useMemo(() => {
    const m: Record<string, string> = {};
    list.forEach((t, i) => {
      const r = data?.[i];
      if (r?.status === "success" && typeof r.result === "bigint")
        m[t.symbol] = r.result.toString();
    });
    return m;
  }, [data, list]);

  return { balances, isLoading };
}

export interface FxMarket {
  base_address: string;
  quote_address: string;
  base_symbol: string;
  quote_symbol: string;
  base_decimals: number;
  quote_decimals: number;
  min_ask_amount?: number;
  min_bid_quote_amount?: number;
}

export function useFxMarkets() {
  return useQuery<{ markets: FxMarket[] }>({
    queryKey: ["fx-markets"],
    queryFn: () => getJSON<{ markets: FxMarket[] }>("/api/fx-markets"),
    staleTime: 5 * 60_000,
  });
}

export interface PendleMarket {
  name: string;
  symbol: string | null;
  marketAddress: string;
  ptAddress: string;
  expiry: string;
  impliedApyPct: number;
  liquidityUsd: number;
  ytFloatingApyPct: number;
  url: string;
}

export function usePendleMarkets() {
  return useQuery<{ markets: PendleMarket[] }>({
    queryKey: ["pendle-markets"],
    queryFn: () => getJSON<{ markets: PendleMarket[] }>("/api/pendle-markets"),
    staleTime: 3 * 60_000,
    refetchInterval: 5 * 60_000,
  });
}

export interface PerpVaults {
  hyperliquid: {
    name: string;
    address: string;
    aprPct: number | null;
    followers?: number;
    url: string;
  } | null;
  gmx: Array<{ name: string; marketToken: string; apyPct: number; url: string }>;
}

export function usePerpVaults() {
  return useQuery<PerpVaults>({
    queryKey: ["perp-vaults"],
    queryFn: () => getJSON<PerpVaults>("/api/perp-vaults"),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}

export interface YieldPool {
  id: string;
  project: string;
  symbol: string;
  chain: string;
  tvlUsd: number | null;
  apy: number | null;
  apyBase: number | null;
  apyReward: number | null;
  ilRisk: string;
  exposure: string;
  tier: "A" | "B" | "C";
  yieldType: "NAV" | "Lending" | "Native" | "LP" | "Gov";
  excessBps: number; // APY − local benchmark, in bps
  score: number; // SDYS 0–100 (BUILD_PLAN § 5.2)
}

export interface YieldsResponse {
  benchmark: { code: string; rate: number };
  pools: YieldPool[];
}

/** All stablecoin yield pools across DeFi via DeFiLlama, scored Pharos-style.
 *  Returns benchmark + pools with SDYS score, excess-bps over benchmark, tier, type. */
export function useYields() {
  return useQuery<YieldsResponse>({
    queryKey: ["yields"],
    queryFn: () => getJSON<YieldsResponse>("/api/yields"),
    staleTime: 2 * 60_000,
    refetchInterval: 5 * 60_000,
  });
}

export function useDebounced<T>(value: T, ms = 400): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

export interface QuotesData {
  "fx-provider": QuoteResult;
  lifi: QuoteResult;
  kyber: QuoteResult;
  cow: QuoteResult;
  /** Server-recommended venue as a source string.
   *  The ranking + FX provider bias logic runs server-side (anti-copy boundary).
   *  Resolve the full quote via data[best] → .quote. */
  best?: "fx-provider" | "lifi" | "kyber" | "cow";
}

/** Live quotes from all 4 desks via a single POST to /api/quotes.
 *  Ranking + FX provider bias happen server-side. Debounced, re-quoted every 15s.
 *  Every ok desk carries its full executable NormalizedQuote (including
 *  netOutRaw + gasUsd) so the client can select and execute any desk.
 *  `data.best` is a source string; resolve the quote via data[data.best].quote. */
export function useQuotes(from?: FxToken, to?: FxToken, amount?: string, owner?: string) {
  const debounced = useDebounced(amount ?? "", 400);
  let rawAmount = "";
  try {
    if (from && debounced && Number(debounced) > 0) rawAmount = toRaw(debounced, from.decimals);
  } catch {
    rawAmount = "";
  }
  const enabled = !!from && !!to && rawAmount !== "" && rawAmount !== "0";

  return useQuery<QuotesData>({
    queryKey: ["quotes", from?.address, to?.address, rawAmount, owner ?? "anon"],
    enabled,
    refetchInterval: 15_000,
    staleTime: 0,
    // Keep showing the previous quotes while a refetch is in flight so the
    // board never blanks/flickers between cycles.
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const params = {
        fromAddress: from!.address,
        toAddress: to!.address,
        fromAmountRaw: rawAmount,
        fromDecimals: from!.decimals,
        toDecimals: to!.decimals,
        owner,
      };

      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(params),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? res.statusText);
      }

      const data = (await res.json()) as {
        best?: "fx-provider" | "lifi" | "kyber" | "cow";
        desks?: Array<{
          source: "fx-provider" | "lifi" | "kyber" | "cow";
          ok: boolean;
          quote?: NormalizedQuote;
          netOutRaw?: string;
          gasUsd?: number;
          reason?: string;
        }>;
        error?: string;
      };

      if (!data.best || !data.desks) {
        // No liquidity — all desks failed.
        const fail = (): QuoteResult => ({
          ok: false,
          reason: "no_liquidity",
          message: "no route",
        });
        return {
          "fx-provider": fail(),
          lifi: fail(),
          kyber: fail(),
          cow: fail(),
          best: undefined,
        };
      }

      // Server now returns the full NormalizedQuote for every ok desk.
      const toQuoteResult = (d: NonNullable<typeof data.desks>[number]): QuoteResult => {
        if (!d.ok || !d.quote) {
          return {
            ok: false,
            reason: (d.reason as "no_liquidity" | "error") ?? "error",
            message: d.reason ?? "no route",
          };
        }
        return { ok: true, quote: d.quote };
      };

      const deskMap = Object.fromEntries(
        (data.desks ?? []).map((d) => [d.source, toQuoteResult(d)]),
      ) as Record<"fx-provider" | "lifi" | "kyber" | "cow", QuoteResult>;

      const fallback: QuoteResult = { ok: false, reason: "error", message: "no data" };

      return {
        "fx-provider": deskMap["fx-provider"] ?? fallback,
        lifi: deskMap.lifi ?? fallback,
        kyber: deskMap.kyber ?? fallback,
        cow: deskMap.cow ?? fallback,
        best: data.best,
      };
    },
  });
}

export interface ScanRow {
  symbol: string;
  address: string;
  decimals: number;
  fxProvider: { ok: true; outRaw: string; rate: number } | { ok: false } | null;
  kyber: { ok: true; outRaw: string; rate: number; tool: string } | { ok: false } | null;
  bestSource: "fx-provider" | "kyber" | null;
}

/** Full-universe rate scan from one FROM token to every target. Hits FX provider batch
 * /swap/quote/batch + LiFi /quote in parallel server-side. */
export function useScan(from?: FxToken, tokens?: FxToken[], probeAmount = 100) {
  const targets = (tokens ?? [])
    .filter((t) => from && t.address.toLowerCase() !== from.address.toLowerCase())
    .map((t) => ({
      address: t.address,
      symbol: t.symbol,
      decimals: t.decimals,
      sources: t.sources,
    }));

  const rawAmount = from ? toRaw(String(probeAmount), from.decimals) : "";

  return useQuery<{ rows: ScanRow[] }>({
    queryKey: ["scan", from?.address, probeAmount, targets.length],
    enabled: !!from && targets.length >= 2,
    refetchInterval: 60_000,
    staleTime: 30_000,
    queryFn: async () => {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          from_token: from!.address,
          from_decimals: from!.decimals,
          from_amount: rawAmount,
          targets: targets.slice(0, 80),
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? res.statusText);
      return res.json();
    },
  });
}
