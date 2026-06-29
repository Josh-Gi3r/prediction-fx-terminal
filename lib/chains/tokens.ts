/**
 * lib/chains/tokens.ts
 *
 * Canonical chain IDs, RPC map, and checksummed token addresses.
 *
 * SINGLE SOURCE OF TRUTH for every address that was previously scattered across:
 *   lib/portfolio/chains.ts      (ETH USDC/USDT, Polygon USDC.e/USDC/USDT, Base USDC)
 *   lib/bridge/quote.ts          (ETH_USDC, ETH_USDT, POLYGON_USDCE)
 *   lib/peer/config.ts           (USDC_BASE, USDC_ETHEREUM — previously LOWERCASED)
 *   lib/polymarket/order.ts      (Polygon USDC.e collateral in getContractConfig)
 *   lib/desks/aave.ts            (ETH USDC/USDT underlying — previously lowercase)
 *   lib/desks/pendleTrade.ts     (USDC_MAINNET)
 *   lib/wagmi/config.ts          (RPC strings — 11 hardcoded occurrences)
 *
 * Rules:
 *   - All addresses are CHECKSUMMED via viem getAddress().
 *   - RPC strings support NEXT_PUBLIC_* env overrides.
 *   - Do NOT edit address bytes here without verifying the original source.
 */

import { getAddress } from "viem";

// ─── Chain IDs ────────────────────────────────────────────────────────────────

export const CHAIN_IDS = {
  ETHEREUM: 1,
  POLYGON: 137,
  BASE: 8453,
  ARBITRUM: 42161,
} as const;

export type SupportedChainId = (typeof CHAIN_IDS)[keyof typeof CHAIN_IDS];

// ─── RPC helpers ─────────────────────────────────────────────────────────────

function rpc(envKey: string, fallback: string): string {
  if (typeof process !== "undefined" && process.env[envKey]) {
    return process.env[envKey] as string;
  }
  return fallback;
}

/**
 * Per-chain RPC URL map. Uses NEXT_PUBLIC_* env vars when set.
 * Defaults are publicnode.com — free, no API key required.
 */
export const CHAIN_RPC: Record<SupportedChainId, string> = {
  [CHAIN_IDS.ETHEREUM]: rpc("NEXT_PUBLIC_RPC", "https://ethereum-rpc.publicnode.com"),
  [CHAIN_IDS.POLYGON]: rpc("NEXT_PUBLIC_POLYGON_RPC", "https://polygon-bor-rpc.publicnode.com"),
  [CHAIN_IDS.BASE]: rpc("NEXT_PUBLIC_BASE_RPC", "https://base-rpc.publicnode.com"),
  [CHAIN_IDS.ARBITRUM]: rpc("NEXT_PUBLIC_ARBITRUM_RPC", "https://arbitrum-one-rpc.publicnode.com"),
};

// ─── Checksummed token addresses ─────────────────────────────────────────────
//
// Byte-verified against original sources. getAddress() only normalises case;
// it does NOT change the underlying address. Any address that survives
// getAddress() is correct — an invalid address would throw at module load time.

/**
 * Ethereum mainnet token addresses.
 * Sources: lib/portfolio/chains.ts, lib/bridge/quote.ts, lib/desks/aave.ts,
 *          lib/desks/pendleTrade.ts, lib/peer/config.ts
 */
export const ETH_TOKENS = {
  USDC: getAddress("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"),
  USDT: getAddress("0xdAC17F958D2ee523a2206206994597C13D831ec7"),
} as const;

/**
 * Polygon mainnet token addresses.
 * Sources: lib/portfolio/chains.ts, lib/polymarket/order.ts (collateral)
 */
export const POLYGON_TOKENS = {
  /** Bridged USDC (PoS bridge) — Polymarket collateral + LiFi bridge destination. */
  USDC_E: getAddress("0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"),
  /** Native USDC (Circle-native). */
  USDC: getAddress("0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359"),
  USDT: getAddress("0xc2132D05D31c914a87C6611C10748AEb04B58e8F"),
} as const;

/**
 * Base mainnet token addresses.
 * Sources: lib/portfolio/chains.ts, lib/peer/config.ts
 *
 * NOTE: lib/peer/config.ts had this address LOWERCASED
 * ("0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"). The checksummed form
 * is identical in bytes — getAddress() normalises to mixed-case EIP-55.
 */
export const BASE_TOKENS = {
  USDC: getAddress("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"),
} as const;

// ─── Convenience re-exports for direct consumers ─────────────────────────────

/** Ethereum USDC — used by bridge source validation, Aave, Pendle, peer config. */
export const ETH_USDC = ETH_TOKENS.USDC;

/** Ethereum USDT — used by bridge source validation, Aave. */
export const ETH_USDT = ETH_TOKENS.USDT;

/** Polygon USDC.e (bridged) — LiFi bridge destination, Polymarket collateral. */
export const POLYGON_USDCE = POLYGON_TOKENS.USDC_E;

/** Base USDC — zkP2P Peer escrow settlement token. */
export const USDC_BASE = BASE_TOKENS.USDC;

/** Ethereum USDC — Peer bridge destination. */
export const USDC_ETHEREUM = ETH_TOKENS.USDC;
