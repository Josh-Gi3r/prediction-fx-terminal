"use client";

import { corridorBySym } from "@/lib/corridors/registry";
import { useUiStore } from "@/stores/ui";
import { DeliverableDrawer } from "./DeliverableDrawer";
import { DifferentialDrawer } from "./DifferentialDrawer";
import { DrawerFrame } from "./DrawerFrame";

/**
 * Trade drawer that picks the right body based on the global instrument.
 */
export function TradeDrawer() {
  const sym = useUiStore((s) => s.drawer.corridorSym);
  const instrument = useUiStore((s) => s.instrument);
  const corridor = sym ? corridorBySym(sym) : undefined;

  return (
    <DrawerFrame>
      {corridor ? (
        instrument === "deliverable" ? (
          <DeliverableDrawer corridor={corridor} />
        ) : (
          <DifferentialDrawer corridor={corridor} />
        )
      ) : null}
    </DrawerFrame>
  );
}
