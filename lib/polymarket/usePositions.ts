"use client";

/**
 * usePositions — fetch Polymarket positions for the connected wallet.
 *
 * Reads from Data API via /api/pm/positions?address=0x... (server proxy
 * to avoid CORS). Shows open prediction market positions (unredeemed
 * conditional tokens held in the user's Polygon wallet).
 *
 * Settlement note (doc §6): winnings settle on-chain directly to the
 * user's Polygon wallet via Polymarket's CTF exchange. This app is never
 * in the payout path — this hook only *reads* those positions.
 */

import { useQuery } from "@tanstack/react-query";
import type { PmCreds } from "./useDeriveCreds";

export interface PmPosition {
  /** Polymarket condition ID */
  conditionId: string;
  /** Human-readable market title */
  title: string;
  /** "YES" or "NO" */
  outcome: string;
  /** Shares held */
  size: number;
  /** Average cost per share in USDC */
  avgPrice: number | null;
  /** Current YES price (from Gamma) — null if market closed */
  currentPrice: number | null;
  /** True if market has resolved */
  resolved: boolean;
  /** Winning outcome if resolved */
  winner: string | null;
}

export interface UsePositions {
  positions: PmPosition[];
  isLoading: boolean;
  error: string | null;
}

export function usePositions(creds: PmCreds | null): UsePositions {
  const query = useQuery<PmPosition[]>({
    queryKey: ["pm", "positions", creds?.address],
    queryFn: async () => {
      if (!creds) return [];
      const res = await fetch(`/api/pm/positions?address=${creds.address}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error((err as { error?: string }).error ?? `positions ${res.status}`);
      }
      const data = (await res.json()) as { positions: PmPosition[] };
      return data.positions;
    },
    enabled: !!creds,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  return {
    positions: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
  };
}
