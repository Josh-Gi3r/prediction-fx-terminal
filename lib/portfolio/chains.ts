"use client";

/**
 * lib/portfolio/chains.ts
 *
 * Per-chain config and multi-chain balance hook for the Portfolio wallet area.
 *
 * Three chains: Ethereum (FX swaps), Polygon (Polymarket bets), Base (zkP2P P2P).
 * The same address (Privy embedded EOA) operates on all three.
 *
 * Token addresses match FundWalletModal + product brief exactly.
 */

import {
  BASE_TOKENS as BASE_TOKS,
  CHAIN_RPC,
  ETH_TOKENS,
  POLYGON_TOKENS as POLY_TOKENS,
} from "@/lib/chains/tokens";
import { useEffect, useMemo, useRef, useState } from "react";
import { http, erc20Abi } from "viem";
import { base, mainnet, polygon } from "wagmi/chains";

// ─── RPCs from canonical chain config ────────────────────────────────────────

const ETH_RPC = CHAIN_RPC[1];
const POLYGON_RPC = CHAIN_RPC[137];
const BASE_RPC = CHAIN_RPC[8453];

// ─── Token definitions ────────────────────────────────────────────────────────

export interface ChainToken {
  /** Checksummed ERC-20 address. */
  address: `0x${string}`;
  symbol: string;
  /** Decimals — 6 for all stables here. */
  decimals: number;
  /** Which action does this token CTA map to? */
  primaryAction: "swap" | "bet" | "p2p" | "bridge";
}

// Ethereum tokens are fetched from /api/tokens at runtime (useMultiChainBalances).
// The static list here is the *minimum* set for the wallet area (swap + bridge CTAs).
export const ETH_STATIC_TOKENS: ChainToken[] = [
  {
    address: ETH_TOKENS.USDC,
    symbol: "USDC",
    decimals: 6,
    primaryAction: "swap",
  },
  {
    address: ETH_TOKENS.USDT,
    symbol: "USDT",
    decimals: 6,
    primaryAction: "swap",
  },
];

export const POLYGON_TOKENS: ChainToken[] = [
  {
    address: POLY_TOKENS.USDC_E,
    symbol: "USDC.e",
    decimals: 6,
    primaryAction: "bet",
  },
  {
    address: POLY_TOKENS.USDC,
    symbol: "USDC",
    decimals: 6,
    primaryAction: "bet",
  },
  {
    address: POLY_TOKENS.USDT,
    symbol: "USDT",
    decimals: 6,
    primaryAction: "bet",
  },
];

export const BASE_TOKENS: ChainToken[] = [
  {
    address: BASE_TOKS.USDC,
    symbol: "USDC",
    decimals: 6,
    primaryAction: "p2p",
  },
];

// ─── Chain config ─────────────────────────────────────────────────────────────

export interface ChainConfig {
  id: number;
  label: string;
  /** Short label for the badge pill. */
  badge: string;
  nativeSymbol: string;
  /** Decimals for native gas token. */
  nativeDecimals: number;
  /** Human note shown next to zero gas balance. */
  gasNote: string;
  explorerTx: (hash: string) => string;
  explorerAddr: (addr: string) => string;
  /** ERC-20 tokens tracked on this chain. */
  tokens: ChainToken[];
  /** viem transport RPC string. */
  rpc: string;
  /** Color accent used in the chain badge. */
  color: string;
}

export const CHAIN_CONFIGS: ChainConfig[] = [
  {
    id: mainnet.id,
    label: "Ethereum",
    badge: "ETH",
    nativeSymbol: "ETH",
    nativeDecimals: 18,
    gasNote: "ETH needed for gas",
    explorerTx: (h) => `https://etherscan.io/tx/${h}`,
    explorerAddr: (a) => `https://etherscan.io/address/${a}`,
    tokens: ETH_STATIC_TOKENS,
    rpc: ETH_RPC,
    color: "#627eea",
  },
  {
    id: polygon.id,
    label: "Polygon",
    badge: "POL",
    nativeSymbol: "POL",
    nativeDecimals: 18,
    gasNote: "needed for prediction approvals",
    explorerTx: (h) => `https://polygonscan.com/tx/${h}`,
    explorerAddr: (a) => `https://polygonscan.com/address/${a}`,
    tokens: POLYGON_TOKENS,
    rpc: POLYGON_RPC,
    color: "#8247e5",
  },
  {
    id: base.id,
    label: "Base",
    badge: "BASE",
    nativeSymbol: "ETH",
    nativeDecimals: 18,
    gasNote: "ETH needed for gas",
    explorerTx: (h) => `https://basescan.org/tx/${h}`,
    explorerAddr: (a) => `https://basescan.org/address/${a}`,
    tokens: BASE_TOKENS,
    rpc: BASE_RPC,
    color: "#0052ff",
  },
];

// ─── Balance types ────────────────────────────────────────────────────────────

export interface TokenBalance {
  token: ChainToken;
  /** Raw bigint balance (0n when unresolved or zero). */
  raw: bigint;
  /** Human number. */
  human: number;
  /** USD value at par for stables (= human). null for non-stables. */
  usd: number | null;
}

export interface ChainBalances {
  chainId: number;
  /** Native gas token balance in human units. */
  nativeHuman: number;
  /** Native raw bigint. */
  nativeRaw: bigint;
  /** ERC-20 token balances. */
  tokens: TokenBalance[];
  /** True while in-flight. */
  loading: boolean;
  /** Non-null if this chain failed. Other chains still return data. */
  error: string | null;
}

export interface MultiChainBalances {
  chains: ChainBalances[];
  /** Sum of all USD-denominated positions across chains. */
  totalUsd: number;
  /** True while at least one chain is loading. */
  anyLoading: boolean;
}

// ─── Pure helpers (tested at unit level) ──────────────────────────────────────

/** Convert raw bigint to human number given decimals. */
export function rawToHuman(raw: bigint, decimals: number): number {
  return Number(raw) / 10 ** decimals;
}

/** All supported stable symbols we treat as 1:1 USD. */
const STABLE_SYMBOLS = new Set(["USDC", "USDC.e", "USDT", "DAI", "FRAX", "XSGD", "STBL"]);

/** USD value at par. Returns null for non-stables. */
export function stableUsd(symbol: string, human: number): number | null {
  if (STABLE_SYMBOLS.has(symbol)) return human;
  return null;
}

/** Aggregate USD totals from an array of chain balances. */
export function sumChainUsd(chains: ChainBalances[]): number {
  return chains.reduce((acc, chain) => {
    const tokenSum = chain.tokens.reduce((s, t) => s + (t.usd ?? 0), 0);
    return acc + tokenSum;
  }, 0);
}

/**
 * Map raw multicall results to TokenBalance[].
 * rawResults length must match tokens length.
 * Failures (null/undefined) produce a zero balance rather than blowing up.
 */
export function mapTokenBalances(
  tokens: ChainToken[],
  rawResults: Array<bigint | null | undefined>,
): TokenBalance[] {
  return tokens.map((token, i) => {
    const raw = rawResults[i] ?? 0n;
    const human = rawToHuman(raw, token.decimals);
    const usd = stableUsd(token.symbol, human);
    return { token, raw, human, usd };
  });
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

const REFRESH_INTERVAL_MS = 30_000;

/**
 * useMultiChainBalances
 *
 * Reads native gas balance + ERC-20 balanceOf for all configured tokens across
 * Ethereum, Polygon and Base in parallel. One chain failing does not blank others.
 *
 * Uses viem public clients directly (no wagmi) so calls are truly parallel and
 * not serialised by a single wagmi chain context. Each chain gets its own
 * createPublicClient on the first read.
 *
 * Returns {chains, totalUsd, anyLoading}.
 *
 * RACE-CONDITION PROTECTION (P1-D fix):
 *   A monotonic generation counter is incremented on each new refresh call. Each
 *   async fetchChain captures its own generation value. Before writing results to
 *   state it checks that the captured generation still matches the current counter.
 *   If the address changes mid-flight (or a new refresh fires before the previous
 *   one completes), the stale responses are silently dropped. This prevents an old
 *   address's balances from briefly overwriting the new address's results.
 */
export function useMultiChainBalances(address: `0x${string}` | undefined): MultiChainBalances {
  const [chains, setChains] = useState<ChainBalances[]>(
    CHAIN_CONFIGS.map((c) => ({
      chainId: c.id,
      nativeHuman: 0,
      nativeRaw: 0n,
      tokens: c.tokens.map((t) => ({ token: t, raw: 0n, human: 0, usd: null })),
      loading: true,
      error: null,
    })),
  );

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /**
   * Monotonic generation counter. Incremented every time a new refresh cycle
   * starts. fetchChain captures a snapshot and discards its result if the counter
   * has moved on before it completes.
   */
  const generationRef = useRef(0);

  // Fetch all balances for a single chain, return partial ChainBalances.
  const fetchChain = async (cfg: ChainConfig, addr: `0x${string}`): Promise<ChainBalances> => {
    // Dynamic import keeps the server bundle lean; viem is tree-shakeable.
    const { createPublicClient } = await import("viem");

    const client = createPublicClient({
      transport: http(cfg.rpc),
    });

    // Native balance + all ERC-20s in parallel.
    const erc20Calls = cfg.tokens.map((t) => ({
      address: t.address,
      abi: erc20Abi,
      functionName: "balanceOf" as const,
      args: [addr] as const,
    }));

    const [nativeRaw, ...tokenRaws] = await Promise.all([
      client.getBalance({ address: addr }).catch(() => 0n),
      ...erc20Calls.map((call) =>
        client
          .readContract(call)
          .then((r) => r as bigint)
          .catch(() => null),
      ),
    ]);

    const native = nativeRaw as bigint;
    const nativeHuman = rawToHuman(native, cfg.nativeDecimals);
    const tokens = mapTokenBalances(cfg.tokens, tokenRaws as Array<bigint | null>);

    return {
      chainId: cfg.id,
      nativeHuman,
      nativeRaw: native,
      tokens,
      loading: false,
      error: null,
    };
  };

  const refresh = async (addr: `0x${string}`) => {
    // Capture the generation at the point this refresh was initiated. Any result
    // that arrives after the generation has advanced (new address / new interval
    // tick) will be discarded to prevent stale writes.
    const myGeneration = ++generationRef.current;

    // Fire all chains simultaneously; each resolves independently.
    await Promise.all(
      CHAIN_CONFIGS.map(async (cfg, idx) => {
        try {
          const result = await fetchChain(cfg, addr);
          if (!mountedRef.current) return;
          // Drop if a newer refresh has started since we were initiated.
          if (generationRef.current !== myGeneration) return;
          setChains((prev) => {
            const next = [...prev];
            next[idx] = result;
            return next;
          });
        } catch (err) {
          if (!mountedRef.current) return;
          if (generationRef.current !== myGeneration) return;
          const message = err instanceof Error ? err.message : "fetch failed";
          setChains((prev) => {
            const next = [...prev];
            const existing = next[idx];
            if (existing) {
              next[idx] = { ...existing, loading: false, error: message };
            }
            return next;
          });
        }
      }),
    );
  };

  // Reset loading state when address changes, then fetch.
  // biome-ignore lint/correctness/useExhaustiveDependencies: refresh is stable (static CHAIN_CONFIGS + mountedRef)
  useEffect(() => {
    if (!address) {
      setChains(
        CHAIN_CONFIGS.map((c) => ({
          chainId: c.id,
          nativeHuman: 0,
          nativeRaw: 0n,
          tokens: c.tokens.map((t) => ({ token: t, raw: 0n, human: 0, usd: null })),
          loading: false,
          error: null,
        })),
      );
      return;
    }

    // Mark loading and bump the generation so any previous in-flight fetches
    // are invalidated before we fire new ones.
    setChains(
      CHAIN_CONFIGS.map((c) => ({
        chainId: c.id,
        nativeHuman: 0,
        nativeRaw: 0n,
        tokens: c.tokens.map((t) => ({ token: t, raw: 0n, human: 0, usd: null })),
        loading: true,
        error: null,
      })),
    );

    refresh(address);

    const interval = setInterval(() => {
      refresh(address);
    }, REFRESH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [address]);

  const totalUsd = useMemo(() => sumChainUsd(chains), [chains]);
  const anyLoading = chains.some((c) => c.loading);

  return { chains, totalUsd, anyLoading };
}
