"use client";

import { useAccount, useChainId } from "wagmi";
import { AavePanel } from "./earn/AavePanel";
import { AutoYieldPanel } from "./earn/AutoYieldPanel";
import { PendlePanel } from "./earn/PendlePanel";
import { PerpVaultsPanel } from "./earn/PerpVaultsPanel";
import { VLPanel } from "./earn/VLPanel";
import { YieldExplorerPanel } from "./earn/YieldExplorerPanel";

// ─── EarnCard root ─────────────────────────────────────────────────────────────
export function EarnCard() {
  const { address, isConnected } = useAccount();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Featured first — Virtual Liquidity is the differentiator */}
      <VLPanel address={address} isConnected={isConnected} />

      {/* Passive + auto-allocate */}
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "stretch" }}
        className="duo"
      >
        <AavePanel />
        <AutoYieldPanel />
      </div>

      {/* Fixed + perp-LP */}
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "stretch" }}
        className="duo"
      >
        <PendlePanel />
        <PerpVaultsPanel />
      </div>

      <YieldExplorerPanel />

      <style>{"@media(max-width:900px){.duo{grid-template-columns:1fr!important}}"}</style>
    </div>
  );
}
