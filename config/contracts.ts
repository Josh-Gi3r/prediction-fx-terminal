/**
 * config/contracts.ts
 *
 * Chain + contract address configuration map.
 *
 * All hardcoded contract addresses that previously lived as inline fallbacks
 * in components are consolidated here. The app reads the canonical addresses
 * from /api/config at runtime (which proxies the settlement provider), and
 * falls back to these defaults when /api/config is unavailable.
 *
 * To point at a different deployment:
 *   1. Change the addresses below, OR
 *   2. Run your own settlement provider that returns different addresses from
 *      its /config endpoint (the app prefers the live endpoint over these defaults).
 *
 * Default addresses: FX settlement provider on Ethereum mainnet (chain 1).
 */

export interface ContractAddresses {
  /** Settlement vault — used by VLPanel/PositionsView for balanceOf calls. */
  vault: `0x${string}`;
  /** Settlement verifying contract — used for EIP-712 domain construction. */
  verifyingContract?: `0x${string}`;
  /** Polymarket CTF Exchange on Polygon (chain 137). */
  polymarketCtfExchange?: `0x${string}`;
  /** Polymarket USDC on Polygon (chain 137). */
  polymarketUsdc?: `0x${string}`;
}

export const CONTRACT_DEFAULTS: Record<number, ContractAddresses> = {
  // Ethereum mainnet
  1: {
    vault: "0xC7d4Fd2638e6630C8C61329878676b88A8A24D43",
  },
  // Sepolia testnet
  11155111: {
    vault: "0x0000000000000000000000000000000000000000", // replace with testnet vault
  },
  // Polygon mainnet (Polymarket)
  137: {
    polymarketCtfExchange: "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E",
    polymarketUsdc: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    vault: "0x0000000000000000000000000000000000000000",
  },
} as const;

/**
 * Returns the contract addresses for the given chain, falling back to mainnet
 * defaults if the chain is unknown.
 */
export function getContractAddresses(chainId: number): ContractAddresses {
  return (
    CONTRACT_DEFAULTS[chainId] ?? CONTRACT_DEFAULTS[1]!
  );
}
