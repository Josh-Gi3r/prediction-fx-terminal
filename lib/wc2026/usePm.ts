"use client";

/**
 * Client hooks for the live Polymarket-backed WC read API (app/api/wc/*).
 * Everything served here has already passed the liquidity gate server-side —
 * if a market is in this data, its book is real and deep.
 */

import { useQuery } from "@tanstack/react-query";

export interface WcLiveMarket {
  key: string;
  category: string;
  eventTitle: string;
  outcomeLabel: string | null;
  eventSlug: string | null;
  icon: string | null;
  question: string;
  teamCode: string | null;
  teamName: string | null;
  groupId: string | null;
  negRisk: boolean;
  tickSize: number;
  minOrderSize: number;
  yesPrice: number | null;
  noPrice: number | null;
  volume: number;
  liquidity: number;
  bestBid: number;
  bestAsk: number;
  live: boolean;
}

interface WcMarketsResponse {
  builtAt: string;
  count: number;
  markets: WcLiveMarket[];
}

export function useWcMarkets(filter?: {
  category?: string;
  team?: string;
  group?: string;
  /** Exact market key lookup — returns a single-market page, ignores limit/offset. */
  key?: string;
  /**
   * Page size (default 100, max 200). Pass 200 when you need a broad result set.
   * Note: total available count is in response.count regardless of page size.
   */
  limit?: number;
  /** Zero-based row offset for pagination. */
  offset?: number;
}) {
  const qs = new URLSearchParams();
  if (filter?.category) qs.set("category", filter.category);
  if (filter?.team) qs.set("team", filter.team);
  if (filter?.group) qs.set("group", filter.group);
  if (filter?.key) qs.set("key", filter.key);
  if (filter?.limit != null) qs.set("limit", String(filter.limit));
  if (filter?.offset != null) qs.set("offset", String(filter.offset));
  const query = qs.toString();
  return useQuery<WcMarketsResponse>({
    queryKey: ["wc", "markets", query],
    queryFn: async () => {
      const res = await fetch(`/api/wc/markets${query ? `?${query}` : ""}`);
      if (!res.ok) throw new Error(`markets ${res.status}`);
      return res.json();
    },
    staleTime: 20_000,
    refetchInterval: 30_000,
  });
}

export interface WcBookLevel {
  price: string;
  size: string;
}

export function useWcBook(key: string | null) {
  return useQuery<{ key: string; question: string; bids?: WcBookLevel[]; asks?: WcBookLevel[] }>({
    queryKey: ["wc", "book", key],
    queryFn: async () => {
      const res = await fetch(`/api/wc/book/${key}`);
      if (!res.ok) throw new Error(`book ${res.status}`);
      return res.json();
    },
    enabled: !!key,
    staleTime: 5_000,
    refetchInterval: 8_000,
  });
}

export function useWcTrades(key: string | null) {
  return useQuery<{ key: string; trades: unknown[]; holders: unknown }>({
    queryKey: ["wc", "trades", key],
    queryFn: async () => {
      const res = await fetch(`/api/wc/trades/${key}`);
      if (!res.ok) throw new Error(`trades ${res.status}`);
      return res.json();
    },
    enabled: !!key,
    staleTime: 15_000,
    refetchInterval: 20_000,
  });
}

export function fmtVolume(v: number): string {
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}k`;
  return `$${v.toFixed(0)}`;
}
