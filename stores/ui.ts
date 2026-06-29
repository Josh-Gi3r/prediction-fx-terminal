import { create } from "zustand";
import { persist } from "zustand/middleware";

export type TradeMode = "visual" | "pro";
export type Instrument = "deliverable" | "differential";
export type DrawerSide = "yes" | "no" | "long" | "short";
export type Density = "comfortable" | "compact";

/**
 * Global UI store.
 *
 * UI state store
 * but with explicit types. `mode`, `density`, and `instrument` are persisted
 * because they're user preferences; `drawer` is intentionally not — closing
 * the tab should always close the drawer.
 */
export interface UiState {
  mode: TradeMode;
  density: Density;
  instrument: Instrument;
  proTenor: 7 | 30 | 60;
  proSide: "long" | "short";
  commandPaletteOpen: boolean;
  drawer: {
    open: boolean;
    corridorSym: string | null; // e.g. "USDC/BRLV"
    wcMarketId: string | null;
    side: DrawerSide;
    sizeRaw: string; // raw input string from the user, formatted on display
    marginCcy: string | null; // ERC-20 address or symbol; null = inherit wallet's largest
  };

  setMode: (mode: TradeMode) => void;
  setDensity: (density: Density) => void;
  setInstrument: (inst: Instrument) => void;
  setProTenor: (tenor: 7 | 30 | 60) => void;
  setProSide: (side: "long" | "short") => void;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  toggleCommandPalette: () => void;

  openDrawer: (args: {
    corridorSym?: string | null;
    wcMarketId?: string | null;
    side?: DrawerSide;
  }) => void;
  closeDrawer: () => void;
  setDrawerSide: (side: DrawerSide) => void;
  setDrawerSize: (sizeRaw: string) => void;
  setDrawerMarginCcy: (ccy: string | null) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      mode: "visual",
      density: "comfortable",
      instrument: "deliverable",
      proTenor: 30,
      proSide: "long",
      commandPaletteOpen: false,
      drawer: {
        open: false,
        corridorSym: null,
        wcMarketId: null,
        side: "yes",
        sizeRaw: "100",
        marginCcy: null,
      },

      setMode: (mode) => set({ mode }),
      setDensity: (density) => set({ density }),
      setInstrument: (instrument) => set({ instrument }),
      setProTenor: (proTenor) => set({ proTenor }),
      setProSide: (proSide) => set({ proSide }),
      openCommandPalette: () => set({ commandPaletteOpen: true }),
      closeCommandPalette: () => set({ commandPaletteOpen: false }),
      toggleCommandPalette: () => set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),

      openDrawer: ({ corridorSym = null, wcMarketId = null, side = "yes" }) =>
        set((s) => ({
          drawer: {
            ...s.drawer,
            open: true,
            corridorSym,
            wcMarketId,
            side,
          },
        })),
      closeDrawer: () => set((s) => ({ drawer: { ...s.drawer, open: false } })),
      setDrawerSide: (side) => set((s) => ({ drawer: { ...s.drawer, side } })),
      setDrawerSize: (sizeRaw) => set((s) => ({ drawer: { ...s.drawer, sizeRaw } })),
      setDrawerMarginCcy: (marginCcy) => set((s) => ({ drawer: { ...s.drawer, marginCcy } })),
    }),
    {
      name: `${process.env.NEXT_PUBLIC_STORAGE_NS ?? "predfx"}.ui`,
      partialize: (state) => ({
        mode: state.mode,
        density: state.density,
        instrument: state.instrument,
        proTenor: state.proTenor,
      }),
    },
  ),
);
