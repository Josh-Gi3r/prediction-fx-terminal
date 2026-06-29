"use client";

/**
 * Keyless Peer reads: best-quote-per-platform + the live USDC/fiat orderbook.
 * These hit api.zkp2p.xyz directly from the browser (their own app is a SPA;
 * no API key required for quotes/orderbook).
 */

import { useQuery } from "@tanstack/react-query";
import {
  type BestByPlatformResponse,
  type GetOrderbookResponse,
  apiGetOrderbook,
  apiGetQuotesBestByPlatform,
} from "@zkp2p/sdk";
import {
  DEST_CHAIN_ID,
  DEST_TOTOKEN,
  PEER_BASE_API_URL,
  PEER_ENABLED,
  referrerFeeConfig,
} from "./config";

/** Placeholder taker for browse-mode quotes (no wallet connected yet). */
const BROWSE_ADDR = "0x000000000000000000000000000000000000dEaD";

export interface PeerQuoteArgs {
  fiatCurrency: string;
  /** Human fiat amount when isExactFiat (default), else USDC amount. */
  amount: string;
  isExactFiat?: boolean;
  user?: string | null;
  recipient?: string | null;
}

export function usePeerQuotes(args: PeerQuoteArgs) {
  const amountOk = Number.parseFloat(args.amount) > 0;
  return useQuery<BestByPlatformResponse>({
    queryKey: [
      "peer",
      "quotes",
      args.fiatCurrency,
      args.amount,
      args.isExactFiat ?? true,
      args.user ?? "browse",
      args.recipient ?? "browse",
    ],
    queryFn: () =>
      apiGetQuotesBestByPlatform(
        {
          fiatCurrency: args.fiatCurrency,
          amount: args.amount,
          isExactFiat: args.isExactFiat ?? true,
          user: args.user ?? BROWSE_ADDR,
          recipient: args.recipient ?? args.user ?? BROWSE_ADDR,
          destinationChainId: DEST_CHAIN_ID,
          destinationToken: DEST_TOTOKEN,
          ...(referrerFeeConfig() ? { referrerFeeConfig: referrerFeeConfig()! } : {}),
        },
        PEER_BASE_API_URL,
      ),
    enabled: PEER_ENABLED && amountOk,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export function usePeerOrderbook(currency: string, paymentPlatform?: string) {
  return useQuery<GetOrderbookResponse>({
    queryKey: ["peer", "orderbook", currency, paymentPlatform ?? "all"],
    queryFn: () =>
      apiGetOrderbook(
        {
          currency,
          ...(paymentPlatform ? { paymentPlatform } : {}),
          sortBy: "price",
          sortDirection: "asc",
          limit: 50,
        },
        PEER_BASE_API_URL,
      ),
    enabled: PEER_ENABLED,
    staleTime: 20_000,
    refetchInterval: 45_000,
  });
}

/* ── Unit converters ─────────────────────────────────────────────────────────
   The orderbook API returns `price` as 1e18 fixed-point (fiat per USDC) and
   token amounts in raw USDC 6-decimals. Convert ONCE here — never render the
   raw strings. */

export function peerPrice(price: string | number | null | undefined): number | null {
  const n = Number(price);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n / 1e18;
}

export function peerUsdcAmount(amount: string | number | null | undefined): number {
  const n = Number(amount);
  return Number.isFinite(n) ? n / 1e6 : 0;
}

/**
 * Robust market rate from an orderbook side: median price of offers with at
 * least `minUsdc` available. The raw best ask is routinely a junk/scam offer
 * (e.g. 0.20 USD per USDC), so first-ask is NOT a usable mid.
 */
export function peerMedianRate(
  entries: Array<{ price?: string | number; availableTokenAmount?: string | number }> | undefined,
  minUsdc = 50,
): number | null {
  if (!entries?.length) return null;
  const prices = entries
    .filter((e) => peerUsdcAmount(e.availableTokenAmount) >= minUsdc)
    .map((e) => peerPrice(e.price))
    .filter((v): v is number => v != null)
    .sort((a, b) => a - b);
  if (!prices.length) return null;
  return prices[Math.floor(prices.length / 2)] ?? null;
}
