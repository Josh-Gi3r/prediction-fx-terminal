"use client";

import { usePerpVaults } from "@/lib/desks/hooks";
import { GmxPanel } from "./GmxPanel";
import { HlpPanel } from "./HlpPanel";
import { EarnSection } from "./shared";

// ─── PerpVaultsPanel ──────────────────────────────────────────────────────────
export function PerpVaultsPanel() {
  const { data, isLoading } = usePerpVaults();
  const hl = data?.hyperliquid;
  const gmx = data?.gmx ?? [];

  return (
    <EarnSection
      id="earn-perp"
      title="Perp DEX LP · be the house"
      subtitle="Stablecoin LPs are the counterparty to perp traders. Earn the spread plus funding rate. Deposit USDC in-app into Hyperliquid HLP or GMX v2 GM pools on Arbitrum."
    >
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "stretch" }}
      >
        {/* Hyperliquid HLP — in-app deposit */}
        <HlpPanel hl={hl} isLoading={isLoading} />

        {/* GMX v2 GM pools — in-app deposit */}
        <GmxPanel gmx={gmx} isLoading={isLoading} />
      </div>
    </EarnSection>
  );
}
