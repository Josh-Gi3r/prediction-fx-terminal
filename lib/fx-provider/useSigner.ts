"use client";

import { ACTIVE_CHAIN } from "@/lib/privy/config";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useEffect, useState } from "react";
import { type Address, createWalletClient, custom } from "viem";
import type { HexString } from "./types";

/**
 * Wallet signer abstraction. Bridges Privy's wallet provider to viem so we can
 * call `signTypedData` against the FX provider's EIP-712 domain without coupling consumer
 * code to Privy or viem directly.
 *
 * Returns `null` while loading or when no wallet is connected. Consumers should
 * disable signing UI until `signer !== null`.
 */
export interface Signer {
  address: Address;
  signTypedData: (args: {
    domain: { name: string; version: string; chainId: number; verifyingContract: Address };
    types: Record<string, ReadonlyArray<{ name: string; type: string }>>;
    primaryType: string;
    message: Record<string, unknown>;
  }) => Promise<HexString>;
}

export function useSigner(): { signer: Signer | null; ready: boolean } {
  const { ready, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const [signer, setSigner] = useState<Signer | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function setup() {
      if (!ready || !authenticated || wallets.length === 0) {
        setSigner(null);
        return;
      }
      const wallet = wallets[0];
      if (!wallet) return;
      try {
        const provider = await wallet.getEthereumProvider();
        const account = wallet.address as Address;
        const client = createWalletClient({
          chain: ACTIVE_CHAIN,
          transport: custom(provider),
          account,
        });
        if (cancelled) return;
        setSigner({
          address: account,
          signTypedData: async ({ domain, types, primaryType, message }) =>
            client.signTypedData({
              account,
              domain,
              // biome-ignore lint/suspicious/noExplicitAny: viem's TypedData generics are too narrow for our runtime-shaped types
              types: types as any,
              primaryType,
              // biome-ignore lint/suspicious/noExplicitAny: same — FX provider's message shapes vary per primaryType
              message: message as any,
            }),
        });
      } catch (err) {
        console.error("useSigner setup failed", err);
        if (!cancelled) setSigner(null);
      }
    }
    setup();
    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, wallets]);

  return { signer, ready };
}
