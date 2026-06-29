"use client";

/**
 * lib/peer/useP2pVaults.ts
 *
 * Fetches the /api/p2p/vaults list and caches it for 2 minutes.
 * Used by SellPanel (deep-link resolution + vault delegation) and AdvancedPanel
 * (vault picker). Extracted to avoid duplicate query definitions.
 */

import type { P2pVault } from "@/app/api/p2p/vaults/route";
import { useQuery } from "@tanstack/react-query";

export function useP2pVaults() {
  return useQuery<{ vaults: P2pVault[] }>({
    queryKey: ["p2p", "vaults"],
    queryFn: async () => {
      const res = await fetch("/api/p2p/vaults");
      if (!res.ok) throw new Error(`vaults ${res.status}`);
      return res.json();
    },
    staleTime: 120_000,
  });
}
