"use client";

/**
 * Wallet-bound Zkp2pClient for on-chain Peer actions (Base 8453):
 * offramp deposits, intent signal/cancel, manual release. All sends are
 * prepare→simulate→sign by the USER's wallet — the app never holds keys.
 */

import { Zkp2pClient } from "@zkp2p/sdk";
import { useMemo } from "react";
import { useWalletClient } from "wagmi";
import { PEER_BASE_API_URL, PEER_CHAIN_ID, PEER_ENV } from "./config";

const RPC_BASE = process.env.NEXT_PUBLIC_BASE_RPC ?? "https://base-rpc.publicnode.com";

/**
 * Returns a Zkp2pClient bound to the connected wallet on Base, or null when
 * no wallet (or the wallet can't switch to Base). Read-only surfaces should
 * use `lib/peer/quotes.ts` instead — quotes/orderbook need no wallet.
 */
export function usePeerClient(): Zkp2pClient | null {
  const { data: walletClient } = useWalletClient({ chainId: PEER_CHAIN_ID });

  return useMemo(() => {
    if (!walletClient) return null;
    try {
      return new Zkp2pClient({
        walletClient,
        chainId: PEER_CHAIN_ID,
        rpcUrl: RPC_BASE,
        runtimeEnv: PEER_ENV,
        baseApiUrl: PEER_BASE_API_URL,
      });
    } catch {
      return null;
    }
  }, [walletClient]);
}
