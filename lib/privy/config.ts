import { arbitrum, base, mainnet, polygon, sepolia } from "wagmi/chains";

/**
 * Active chain for the deployment. Mainnet by default — The FX provider's live API and the
 * LiFi/Kyber/CoW comparison desks only exist on Ethereum mainnet. Set
 * NEXT_PUBLIC_FX_PROVIDER_CHAIN_ID=11155111 explicitly for a Sepolia testnet build.
 */
export const ACTIVE_CHAIN =
  process.env.NEXT_PUBLIC_FX_PROVIDER_CHAIN_ID === "11155111" ? sepolia : mainnet;

export const SUPPORTED_CHAINS = [mainnet, base, polygon, sepolia, arbitrum] as const;

/**
 * Privy app id. Set NEXT_PUBLIC_PRIVY_APP_ID in `.env.local`.
 *
 * When unset, `PRIVY_APP_ID` is `null` and the Providers component skips
 * mounting the Privy + Wagmi stack entirely. The ConnectButton renders a
 * disabled "Connect" pill in that case. This lets the dev/build pipeline
 * work without Privy credentials; flipping it on later is one env var.
 */
const RAW = process.env.NEXT_PUBLIC_PRIVY_APP_ID?.trim() ?? "";

export const PRIVY_APP_ID: string | null = RAW && RAW !== "placeholder-replace-me" ? RAW : null;

export const PRIVY_ENABLED = PRIVY_APP_ID !== null;
