"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { type FxProviderClient, fxClient } from "./client";
import type { Address } from "./types";

/**
 * React Query hooks over the FX Provider REST API.
 *
 * Polling cadence is chosen per-endpoint to match how the data changes:
 *  - /fx/rate           1s  (price feed)
 *  - /balances          3s  (mutates on every trade)
 *  - /tokens/markets    60s (registry, near-static)
 *  - /config            5m  (chain bootstrap)
 *  - /health            on focus only
 *
 * All hooks accept an optional `client` override so we can swap in an
 * api-key-authenticated client without rewiring providers.
 */

const KEYS = {
  health: ["fx-provider", "health"] as const,
  systemTime: ["fx-provider", "system-time"] as const,
  tokens: ["fx-provider", "tokens"] as const,
  markets: ["fx-provider", "markets"] as const,
  config: ["fx-provider", "config"] as const,
  fxRate: (base: string, quote: string) =>
    ["fx-provider", "fx-rate", base.toUpperCase(), quote.toUpperCase()] as const,
  balances: (owner: Address | null) => ["fx-provider", "balances", owner] as const,
  orders: (owner: Address | null, status?: string) =>
    ["fx-provider", "orders", owner, status ?? "all"] as const,
};

export function useHealth(client: FxProviderClient = fxClient) {
  return useQuery({
    queryKey: KEYS.health,
    queryFn: ({ signal }) => client.health(signal),
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: true,
  });
}

export function useSystemTime(client: FxProviderClient = fxClient) {
  return useQuery({
    queryKey: KEYS.systemTime,
    queryFn: ({ signal }) => client.systemTime(signal),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useTokens(client: FxProviderClient = fxClient) {
  return useQuery({
    queryKey: KEYS.tokens,
    queryFn: ({ signal }) => client.tokens(signal),
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });
}

export function useMarkets(client: FxProviderClient = fxClient) {
  return useQuery({
    queryKey: KEYS.markets,
    queryFn: ({ signal }) => client.markets(signal),
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });
}

export function useConfig(client: FxProviderClient = fxClient) {
  return useQuery({
    queryKey: KEYS.config,
    queryFn: ({ signal }) => client.config(signal),
    staleTime: 5 * 60_000,
    refetchInterval: false,
  });
}

export function useFxRate(
  base: string | null,
  quote: string | null,
  options: { enabled?: boolean; refetchMs?: number } = {},
  client: FxProviderClient = fxClient,
) {
  const enabled = options.enabled !== false && !!base && !!quote;
  return useQuery({
    queryKey: KEYS.fxRate(base ?? "", quote ?? ""),
    queryFn: ({ signal }) =>
      client.fxRate((base as string).toUpperCase(), (quote as string).toUpperCase(), signal),
    enabled,
    staleTime: 800,
    refetchInterval: options.refetchMs ?? 1000,
  });
}

/**
 * Balances require an authenticated client. Pass one created from an API key
 * the user has provisioned (via `useAuthedClient`). If `owner` is null or the
 * client is null, the hook stays disabled.
 */
export function useBalances(
  owner: Address | null,
  client: FxProviderClient | null,
  options: { enabled?: boolean; includeZero?: boolean } = {},
) {
  const enabled = options.enabled !== false && !!owner && !!client;
  return useQuery({
    queryKey: KEYS.balances(owner),
    queryFn: ({ signal }) =>
      (client as FxProviderClient).balances(owner as Address, options.includeZero ?? false, signal),
    enabled,
    staleTime: 1_500,
    refetchInterval: 3_000,
  });
}

/**
 * List orders for the connected wallet. Requires the authenticated client.
 *
 * Pass `client` from `useAuthedClient()`. While the client is null (no API key
 * yet), the query stays disabled and returns no data.
 */
export function useOrders(
  owner: Address | null,
  client: FxProviderClient | null,
  options: { limit?: number; offset?: number; status?: string; enabled?: boolean } = {},
) {
  const enabled = options.enabled !== false && !!owner && !!client;
  return useQuery({
    queryKey: KEYS.orders(owner, options.status),
    queryFn: ({ signal }) =>
      (client as FxProviderClient).listOrders(
        owner as Address,
        { limit: options.limit, offset: options.offset, status: options.status },
        signal,
      ),
    enabled,
    staleTime: 3_000,
    refetchInterval: 5_000,
  });
}

/**
 * Convenience: look up a token's metadata by ERC-20 address (case-insensitive).
 * Returns undefined while loading or when not present in the registry.
 */
export function useTokenByAddress(address: Address | null | undefined) {
  const { data } = useTokens();
  return useMemo(() => {
    if (!address || !data) return undefined;
    const lc = address.toLowerCase();
    return data.tokens.find((t) => t.address.toLowerCase() === lc);
  }, [address, data]);
}

/**
 * Convenience: look up a token by symbol.
 */
export function useTokenBySymbol(symbol: string | null | undefined) {
  const { data } = useTokens();
  return useMemo(() => {
    if (!symbol || !data) return undefined;
    const uc = symbol.toUpperCase();
    return data.tokens.find((t) => t.symbol.toUpperCase() === uc);
  }, [symbol, data]);
}
