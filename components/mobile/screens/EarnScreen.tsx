"use client";

/**
 * components/mobile/screens/EarnScreen.tsx
 * Shell ≤300 lines. All panel logic lives in components/mobile/earn/.
 *
 * Segments:
 *   vl      → VLMaker
 *   lend    → AaveModule + PendleSection + PerpDexSection
 *   vaults  → VaultsModule
 *   smart   → SmartYield
 *   explore → YieldsExplorer
 */

import { AaveModule } from "@/components/mobile/earn/AaveModule";
import { EarnHelpSheet } from "@/components/mobile/earn/EarnHelpSheet";
import { PendleSection } from "@/components/mobile/earn/PendleTile";
import { PerpDexSection } from "@/components/mobile/earn/PerpPanels";
import { SmartYield } from "@/components/mobile/earn/SmartYield";
import { VLMaker } from "@/components/mobile/earn/VLMaker";
import { VaultsModule } from "@/components/mobile/earn/VaultsModule";
import { YieldsExplorer } from "@/components/mobile/earn/YieldsExplorer";
import { Disclaimer } from "@/components/mobile/primitives";
import { useState } from "react";
import { Icon } from "../Icon";

/* ── LendModule (Aave + Pendle + HLP + GMX combined) ───────────────────────── */

function LendModule() {
  return (
    <div className="fade-in">
      <AaveModule />
      <PendleSection />
      <PerpDexSection />
    </div>
  );
}

/* ── EarnScreen root ────────────────────────────────────────────────────────── */

interface EarnScreenProps {
  onBack?: () => void;
  onToast: (msg: string) => void;
}

export function EarnScreen({ onBack, onToast }: EarnScreenProps) {
  const [seg, setSeg] = useState("vl");
  const [helpOpen, setHelpOpen] = useState(false);
  return (
    <div className="screen">
      <div className="appbar">
        {onBack && (
          <button type="button" className="iconbtn" onClick={onBack} aria-label="Back">
            <Icon name="back" size={20} />
          </button>
        )}
        <div className="ab-title">Earn</div>
        <span className="grow" />
        <button
          type="button"
          className="iconbtn"
          aria-label="How Earn works"
          onClick={() => setHelpOpen(true)}
        >
          <Icon name="info" size={19} />
        </button>
      </div>

      {helpOpen && <EarnHelpSheet onClose={() => setHelpOpen(false)} />}

      <div style={{ margin: "0 18px 4px" }}>
        <div className="eyebrow" style={{ marginBottom: 4 }}>
          <span className="tick" />
          Non-custodial · you sign every leg
        </div>
      </div>

      <div className="chiprow" style={{ marginBottom: 14, marginTop: 8 }}>
        {[
          ["vl", "VL ★"],
          ["lend", "Lend"],
          ["vaults", "Vaults"],
          ["smart", "Smart Yield"],
          ["explore", "Explore"],
        ].map(([k, l]) => (
          <button
            type="button"
            key={k}
            className={`chip${seg === k ? " on" : ""}`}
            onClick={() => setSeg(k ?? "vl")}
          >
            {l}
          </button>
        ))}
      </div>

      {seg === "vl" && <VLMaker onToast={onToast} />}
      {seg === "lend" && <LendModule />}
      {seg === "vaults" && <VaultsModule />}
      {seg === "smart" && <SmartYield />}
      {seg === "explore" && <YieldsExplorer />}

      <Disclaimer />

      {/* Scoped styles for the real-flow panels */}
      <style>{`
        .arow-wrap { margin-bottom: 8px; }
        .arow { display:flex; align-items:center; gap:8px; background:var(--bg-soft); border:1px solid var(--line); border-radius:13px; padding:11px 14px; }
        .arow .sym { font-weight:800; font-size:14.5px; flex:1; }
        .arow .apy { font-family:var(--f-tech); font-weight:700; color:var(--yes); font-size:14px; }
        .inline-panel { margin-top:10px; background:#fff; border:1px solid var(--line); border-radius:11px; padding:12px; display:flex; flex-direction:column; gap:8px; }
        .tile-y-wrap { border:1px solid var(--line); border-radius:13px; margin-bottom:8px; overflow:hidden; background:var(--bg-soft); transition:.14s; }
        .tile-y-wrap.open { border-color:var(--brand-3); background:#fff; }
        .tile-y-head { width:100%; text-align:left; background:none; border:0; padding:14px; cursor:pointer; display:block; }
        .tile-y-panel { border-top:1px solid var(--line); padding:14px; display:flex; flex-direction:column; gap:10px; }
        .perp-tile { border:1px solid var(--line); border-radius:13px; margin-bottom:8px; overflow:hidden; background:var(--bg-soft); transition:.14s; }
        .perp-tile.open { border-color:var(--brand-3); background:#fff; }
        .perp-tile-head { width:100%; text-align:left; background:none; border:0; padding:14px; cursor:pointer; display:block; }
        .gm-row { display:flex; justify-content:space-between; align-items:center; gap:10px; padding:7px 8px; border-radius:8px; font-size:12.5px; color:var(--muted); background:none; border:1px solid transparent; cursor:pointer; width:100%; text-align:left; transition:.12s; }
        .gm-row.on { background:var(--bg-tint); border-color:var(--brand-3); }
        .gm-row .v.yes { font-family:var(--f-tech); font-weight:700; color:var(--yes); flex-shrink:0; }
        .quote-box { border-radius:10px; border:1px solid var(--line); background:var(--bg-soft); padding:10px 13px; font-size:12px; color:var(--muted); display:flex; flex-direction:column; gap:5px; }
        .qrow { display:flex; justify-content:space-between; font-size:12px; }
        .qrow .mono { font-family:var(--f-tech); font-weight:700; color:var(--ink); }
        .qrow .mono.yes { color:var(--yes); }
        .status-note { border-radius:9px; border:1px solid rgba(100,130,240,.25); background:rgba(100,130,240,.05); padding:8px 11px; font-size:12px; color:var(--brand); }
        .warn-banner { display:flex; align-items:center; justify-content:space-between; gap:10px; border-radius:9px; border:1px solid rgba(240,172,67,.4); background:rgba(240,172,67,.08); padding:9px 12px; font-size:12.5px; color:#8a5f0a; margin-bottom:4px; }
        .warn-btn { font-family:var(--f-tech); font-weight:700; font-size:11px; padding:6px 12px; border-radius:8px; border:1px solid #c2750a; background:#fff; color:#8a5f0a; cursor:pointer; white-space:nowrap; }
        .err-banner { border-radius:9px; border:1px solid rgba(240,67,106,.3); background:rgba(240,67,106,.06); padding:8px 11px; font-size:12px; color:#b61441; display:flex; align-items:center; justify-content:space-between; gap:8px; }
        .eb-msg { flex:1; overflow-wrap:anywhere; }
        .eb-retry { font-family:var(--f-tech); font-size:11px; padding:4px 9px; border-radius:7px; border:1px solid rgba(240,67,106,.3); background:#fff; color:#b61441; cursor:pointer; flex-shrink:0; }
        .ok-banner { border-radius:9px; border:1px solid rgba(19,185,129,.4); background:rgba(19,185,129,.07); padding:11px 13px; font-size:13px; color:#0a7a53; }
        .info-note { border-radius:9px; border:1px solid var(--line); background:var(--bg-soft); padding:8px 11px; font-size:11.5px; color:var(--muted); line-height:1.55; }
        .field-err { margin-top:4px; font-size:11px; color:var(--no); }
        .max-btn { font-family:var(--f-tech); font-size:11.5px; color:var(--brand); background:none; border:0; cursor:pointer; padding:0; }
        .btn-sm { font-family:var(--f-tech); font-weight:700; font-size:12px; background:var(--grad-brand); color:#fff; border:0; border-radius:9px; padding:8px 15px; cursor:pointer; }
        .btn-sm-outline { font-family:var(--f-tech); font-weight:700; font-size:11px; background:#fff; color:#8a5f0a; border:1px solid #c2750a; border-radius:8px; padding:6px 11px; cursor:pointer; }
      `}</style>
    </div>
  );
}
