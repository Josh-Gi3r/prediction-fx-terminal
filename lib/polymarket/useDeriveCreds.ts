"use client";

/**
 * Derive Polymarket L2 CLOB credentials from the user's wallet (Polygon).
 *
 * Security model (mirrors lib/fx-provider/useApiKey.ts but stricter per audit H1):
 * - Creds are held IN MEMORY (React state) only — no localStorage, no
 *   sessionStorage. They re-derive on next session from the same wallet
 *   signature (deterministic). One wallet sig = ~2s UX cost.
 * - Creds never leave the browser and never reach our server routes.
 * - The wallet must be on Polygon (chain 137). We prompt chain-switch if not.
 *
 * The ClobClient.deriveApiKey() call does the CLOB EIP-712 L1 signature
 * via the WalletClient, then returns {key, secret, passphrase} from PM's
 * API.
 */

import { Chain, ClobClient, SignatureType } from "@polymarket/clob-client";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useCallback, useEffect, useRef, useState } from "react";
import { createWalletClient, custom } from "viem";
import { polygon } from "wagmi/chains";

const CLOB_HOST = "https://clob.polymarket.com";

export interface PmCreds {
  key: string;
  secret: string;
  passphrase: string;
  address: string;
}

export interface UseDeriveCreds {
  creds: PmCreds | null;
  derive: () => Promise<PmCreds>;
  pending: boolean;
  error: string | null;
  /** True once Privy is ready and a wallet is connected. */
  ready: boolean;
}

/**
 * Returns in-memory Polymarket L2 creds for the connected wallet.
 * Call `derive()` to trigger the one-time wallet signature flow.
 * Creds reset on wallet change or page reload — re-derive is one sig.
 */
export function useDeriveCreds(): UseDeriveCreds {
  const { ready, authenticated } = usePrivy();
  const { wallets } = useWallets();

  const [creds, setCreds] = useState<PmCreds | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset creds when the active wallet changes
  const lastAddress = useRef<string | null>(null);
  const wallet = wallets[0] ?? null;

  useEffect(() => {
    if (!wallet) {
      lastAddress.current = null;
      setCreds(null);
      return;
    }
    if (wallet.address !== lastAddress.current) {
      lastAddress.current = wallet.address;
      setCreds(null);
    }
  }, [wallet]);

  const isReady = ready && authenticated && !!wallet;

  const derive = useCallback(async (): Promise<PmCreds> => {
    if (!wallet) throw new Error("Wallet not connected");

    setPending(true);
    setError(null);

    try {
      // Switch to Polygon if needed
      await wallet.switchChain(polygon.id);

      const provider = await wallet.getEthereumProvider();
      const account = wallet.address as `0x${string}`;

      const walletClient = createWalletClient({
        chain: polygon,
        transport: custom(provider),
        account,
      });

      // ClobClient accepts a viem WalletClient directly as ClobSigner
      const client = new ClobClient(
        CLOB_HOST,
        Chain.POLYGON,
        // biome-ignore lint/suspicious/noExplicitAny: viem WalletClient is a valid ClobSigner per library types
        walletClient as any,
        undefined,
        SignatureType.EOA,
      );

      const apiKeyCreds = await client.createOrDeriveApiKey();

      const result: PmCreds = {
        key: apiKeyCreds.key,
        secret: apiKeyCreds.secret,
        passphrase: apiKeyCreds.passphrase,
        address: account,
      };

      setCreds(result);
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      throw err;
    } finally {
      setPending(false);
    }
  }, [wallet]);

  return { creds, derive, pending, error, ready: isReady };
}
