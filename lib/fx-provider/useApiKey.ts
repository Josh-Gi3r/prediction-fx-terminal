"use client";

import { useCallback, useState } from "react";
import { fxClient } from "./client";
import { getFxProviderBaseUrl } from "./config";
import { ManageApiKeyTypes } from "./eip712";
import { type Signer, useSigner } from "./useSigner";

export interface ApiKeyPair {
  apiKey: string;
  apiSecret: string;
}

/**
 * API key lifecycle for the connected wallet.
 *
 * Keys are held in React state only (memory-only). They are NOT persisted to
 * localStorage or any other storage — they die on page reload by design.
 *
 * Future pattern: derive the key pair per session via a wallet signature
 * (`ManageApiKey` EIP-712) and re-prompt on reload. Call `create()` once per
 * session to mint/retrieve a key from the FX Provider API before making authenticated
 * requests. Use `revoke()` to clear the in-memory pair (e.g. on disconnect).
 */
export function useApiKey() {
  const { signer } = useSigner();
  const [pair, setPair] = useState<ApiKeyPair | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = useCallback(
    async (label = (process.env.NEXT_PUBLIC_APP_NAME ?? "PredFX Terminal") + " web"): Promise<ApiKeyPair> => {
      if (!signer) throw new Error("Wallet not connected");
      setPending(true);
      setError(null);
      try {
        const cfg = await fxClient.config();
        const timestamp = Math.floor(Date.now() / 1000);
        const signature = await signer.signTypedData({
          domain: cfg.eip712_domain,
          types: { ManageApiKey: [...ManageApiKeyTypes.ManageApiKey] },
          primaryType: "ManageApiKey",
          message: {
            owner: signer.address,
            action: "create",
            timestamp,
          },
        });
        const base = getFxProviderBaseUrl();
        const res = await fetch(`${base}/api-keys`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            owner_address: signer.address,
            action: "create",
            timestamp,
            signature,
            label,
          }),
        });
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`API key creation failed: ${res.status} ${txt}`);
        }
        const data = await res.json();
        const newPair: ApiKeyPair = {
          apiKey: data.api_key,
          apiSecret: data.api_secret,
        };
        setPair(newPair);
        return newPair;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        throw err;
      } finally {
        setPending(false);
      }
    },
    [signer],
  );

  const revoke = useCallback(() => {
    setPair(null);
  }, []);

  return { pair, create, revoke, pending, error, signer };
}
