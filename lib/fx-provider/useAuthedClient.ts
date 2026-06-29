"use client";

import { useMemo } from "react";
import { FxProviderClient } from "./client";
import { useApiKey } from "./useApiKey";

/**
 * Returns a FxProviderClient instance bearer-authenticated with the connected wallet's
 * API key, or `null` if no key exists yet. Pair with `useApiKey().create()` to
 * mint a key on demand before calling authenticated routes.
 */
export function useAuthedClient(): FxProviderClient | null {
  const { pair } = useApiKey();
  return useMemo(() => {
    if (!pair) return null;
    return new FxProviderClient({ apiKey: pair.apiKey, apiSecret: pair.apiSecret });
  }, [pair]);
}
