import { CHAIN_RPC } from "@/lib/chains/tokens";
import { ACTIVE_CHAIN } from "@/lib/privy/config";
import { createConfig } from "@privy-io/wagmi";
import { http } from "viem";
import { createConfig as createStandaloneConfig } from "wagmi";
import { arbitrum, base, mainnet, polygon, sepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";

/** Active chain, re-exported for signing/tx call sites (useSwap, VL, Aave). */
export const CHAIN = ACTIVE_CHAIN;

const transports = {
  [mainnet.id]: http(ACTIVE_CHAIN.id === mainnet.id ? CHAIN_RPC[1] : undefined),
  [sepolia.id]: http(),
  // Base carries the Peer (zkP2P) escrow — onramp/offramp txs sign here even
  // though onramped USDC bridges to Ethereum for FX trades.
  [base.id]: http(CHAIN_RPC[8453]),
  // Polygon carries Polymarket's CTF exchange (WC prediction settlement).
  [polygon.id]: http(CHAIN_RPC[137]),
  // Arbitrum carries GMX v2 GM pool deposits and the Hyperliquid USDC bridge.
  [arbitrum.id]: http(CHAIN_RPC[42161]),
};

/**
 * Wagmi config wired through Privy.
 *
 * Privy manages the connector layer so we never instantiate WalletConnect /
 * Injected / etc. ourselves — the user signs in via Privy and we receive a
 * standard EIP-1193 provider through the wagmi hooks.
 */
export const wagmiConfig = createConfig({
  chains: [sepolia, mainnet, base, polygon, arbitrum],
  transports,
});

/**
 * Standalone wagmi config (plain injected() EOA — MetaMask/Rabby) used when
 * Privy is not configured. Keeps the full app — swaps, VL, Aave — usable
 * without Privy credentials; flipping Privy on later is one env var.
 */
export const standaloneWagmiConfig = createStandaloneConfig({
  chains: [sepolia, mainnet, base, polygon, arbitrum],
  connectors: [injected()],
  transports,
  ssr: true,
});
