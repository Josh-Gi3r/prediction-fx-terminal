import type { FxToken } from "@/lib/fx-provider/core/types";
import { create } from "zustand";

/**
 * Cross-page handoff: Markets row click → prefill the Swap page.
 * Intentionally not persisted — a stale prefill after reload is worse than none.
 */
interface SwapIntentState {
  pending: { from: FxToken; to: FxToken } | null;
  setPending: (pair: { from: FxToken; to: FxToken }) => void;
  consume: () => void;
}

export const useSwapIntent = create<SwapIntentState>((set) => ({
  pending: null,
  setPending: (pair) => set({ pending: pair }),
  consume: () => set({ pending: null }),
}));
