"use client";

/**
 * components/account/SettingsTab.tsx
 *
 * Account settings persisted to localStorage via lib/account/preferences.ts.
 *
 * LIVE-WIRED:
 *   - slippage: stored pref is read by getSlippageDecimal(); SwapCard reads it
 *     on every quote via the hook below (TODO comment in useSwap.ts for deep wiring).
 *
 * STORED-ONLY (delivery TBD, marked "coming soon" where applicable):
 *   - settlementStablecoin
 *   - defaultChain
 *   - oddsFormat
 *   - notifications.*
 */

import {
  type AccountPrefs,
  DEFAULT_PREFS,
  type SlippageBps,
  readPrefs,
  writePrefs,
} from "@/lib/account/preferences";
import { useAccountSync } from "@/lib/account/useAccountSync";
import { STABLE_SYMBOLS } from "@/lib/desks/stablecoins";
import { useEffect, useState } from "react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SLIPPAGE_PRESETS: Array<{ label: string; bps: SlippageBps }> = [
  { label: "0.1%", bps: 10 },
  { label: "0.5%", bps: 50 },
  { label: "1.0%", bps: 100 },
];

const CHAIN_OPTIONS: Array<{ id: number; label: string }> = [
  { id: 1, label: "Ethereum" },
  { id: 137, label: "Polygon" },
  { id: 8453, label: "Base" },
];

const ODDS_OPTIONS: Array<{ value: AccountPrefs["oddsFormat"]; label: string }> = [
  { value: "cents", label: "Cents (85c)" },
  { value: "percent", label: "Percent (85%)" },
  { value: "american", label: "American (+567)" },
];

// ─── Section wrapper ──────────────────────────────────────────────────────────

function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="pf-card">
      <div style={{ marginBottom: 12 }}>
        <div className="eyebrow">
          <span className="tick" />
          {title}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>{children}</div>
    </div>
  );
}

// ─── Row wrapper ──────────────────────────────────────────────────────────────

function SettingsRow({
  label,
  sub,
  children,
  badge,
}: {
  label: string;
  sub?: string;
  children: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        flexWrap: "wrap",
        paddingBottom: 12,
        borderBottom: "1px solid var(--line)",
      }}
    >
      <div style={{ flex: 1, minWidth: 160 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{label}</div>
          {badge}
        </div>
        {sub && (
          <div style={{ fontSize: 11, color: "var(--muted-2)", marginTop: 2, lineHeight: 1.5 }}>
            {sub}
          </div>
        )}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

function ComingSoonBadge() {
  return (
    <span
      style={{
        fontFamily: "var(--f-tech)",
        fontSize: 8,
        fontWeight: 800,
        letterSpacing: ".1em",
        textTransform: "uppercase" as const,
        color: "var(--muted-2)",
        background: "var(--bg-soft)",
        border: "1px solid var(--line)",
        borderRadius: 5,
        padding: "2px 6px",
      }}
    >
      coming soon
    </span>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        width: 40,
        height: 22,
        borderRadius: 999,
        background: checked ? "var(--brand)" : "var(--bg-tint)",
        border: "1px solid var(--line)",
        position: "relative",
        cursor: "pointer",
        transition: "background .15s",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: checked ? 20 : 2,
          width: 16,
          height: 16,
          borderRadius: "50%",
          background: "#fff",
          boxShadow: "0 1px 3px rgba(0,0,0,.18)",
          transition: "left .15s",
        }}
      />
    </button>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function SettingsTab() {
  const [prefs, setPrefs] = useState<AccountPrefs>(DEFAULT_PREFS);
  const [customSlippage, setCustomSlippage] = useState("");
  const [saved, setSaved] = useState(false);
  const { ensureSynced } = useAccountSync();

  // Load from localStorage on mount, then pull the server copy across devices.
  // ensureSynced is lazy + never forced: probes the session first, only prompts
  // a signature if needed; declining leaves everything on localStorage.
  useEffect(() => {
    const p = readPrefs();
    setPrefs(p);
    if (p.slippageCustom) setCustomSlippage(p.slippageCustom);
    ensureSynced().then((ok) => {
      if (ok) setPrefs(readPrefs());
    });
  }, [ensureSynced]);

  function update(patch: Partial<AccountPrefs>) {
    const next = writePrefs(patch);
    setPrefs(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  const activeSlippageBps = prefs.slippageBps;
  const isCustomSlippage = !SLIPPAGE_PRESETS.some((p) => p.bps === activeSlippageBps);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Save feedback */}
      {saved && (
        <div
          style={{
            fontFamily: "var(--f-tech)",
            fontSize: 12,
            color: "var(--yes)",
            background: "var(--yes-soft)",
            border: "1px solid var(--yes)",
            borderRadius: 9,
            padding: "8px 14px",
            textAlign: "center",
          }}
        >
          Preferences saved
        </div>
      )}

      {/* Trading */}
      <SettingsSection title="Trading">
        {/* Slippage */}
        <SettingsRow
          label="Default slippage"
          sub="Applied to swap quotes. LIVE-WIRED: this value is read by the swap engine."
        >
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            {SLIPPAGE_PRESETS.map((p) => (
              <button
                key={p.bps}
                type="button"
                onClick={() => {
                  setCustomSlippage("");
                  update({ slippageBps: p.bps, slippageCustom: null });
                }}
                style={{
                  fontFamily: "var(--f-tech)",
                  fontSize: 12,
                  fontWeight: 700,
                  color: activeSlippageBps === p.bps && !isCustomSlippage ? "#fff" : "var(--ink)",
                  background:
                    activeSlippageBps === p.bps && !isCustomSlippage
                      ? "var(--brand)"
                      : "var(--bg-soft)",
                  border: "1px solid var(--line)",
                  borderRadius: 8,
                  padding: "5px 12px",
                  cursor: "pointer",
                  transition: "background .12s",
                }}
              >
                {p.label}
              </button>
            ))}
            {/* Custom */}
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <input
                type="number"
                min="0.01"
                max="50"
                step="0.01"
                value={customSlippage}
                placeholder="Custom"
                onChange={(e) => {
                  const val = e.target.value;
                  setCustomSlippage(val);
                  if (val && !Number.isNaN(Number(val))) {
                    const bps = Math.round(Number(val) * 100);
                    update({ slippageBps: bps, slippageCustom: val });
                  }
                }}
                style={{
                  width: 68,
                  fontFamily: "var(--f-tech)",
                  fontSize: 12,
                  fontWeight: 700,
                  color: isCustomSlippage ? "var(--brand)" : "var(--ink)",
                  background: isCustomSlippage ? "var(--bg-tint)" : "var(--bg-soft)",
                  border: `1px solid ${isCustomSlippage ? "var(--brand)" : "var(--line)"}`,
                  borderRadius: 8,
                  padding: "5px 8px",
                  outline: "none",
                }}
              />
              {customSlippage && <span style={{ fontSize: 11, color: "var(--muted-2)" }}>%</span>}
            </div>
          </div>
        </SettingsRow>

        {/* Settlement stablecoin */}
        <SettingsRow
          label="Settlement stablecoin"
          sub="Your preferred output token. Stored - delivery TBD."
          badge={<ComingSoonBadge />}
        >
          <select
            value={prefs.settlementStablecoin}
            onChange={(e) => update({ settlementStablecoin: e.target.value })}
            style={{
              fontFamily: "var(--f-tech)",
              fontSize: 12,
              fontWeight: 700,
              color: "var(--ink)",
              background: "var(--bg-soft)",
              border: "1px solid var(--line)",
              borderRadius: 8,
              padding: "5px 10px",
              cursor: "pointer",
            }}
          >
            {STABLE_SYMBOLS.slice(0, 12).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </SettingsRow>

        {/* Default chain */}
        <SettingsRow label="Default chain" sub="Stored - delivery TBD." badge={<ComingSoonBadge />}>
          <select
            value={prefs.defaultChain}
            onChange={(e) => update({ defaultChain: Number(e.target.value) })}
            style={{
              fontFamily: "var(--f-tech)",
              fontSize: 12,
              fontWeight: 700,
              color: "var(--ink)",
              background: "var(--bg-soft)",
              border: "1px solid var(--line)",
              borderRadius: 8,
              padding: "5px 10px",
              cursor: "pointer",
            }}
          >
            {CHAIN_OPTIONS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </SettingsRow>
      </SettingsSection>

      {/* Display */}
      <SettingsSection title="Display">
        <SettingsRow
          label="Odds format"
          sub="How prediction market odds are displayed. Stored - delivery TBD."
          badge={<ComingSoonBadge />}
        >
          <div style={{ display: "flex", gap: 6 }}>
            {ODDS_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => update({ oddsFormat: o.value })}
                style={{
                  fontFamily: "var(--f-tech)",
                  fontSize: 11,
                  fontWeight: 700,
                  color: prefs.oddsFormat === o.value ? "#fff" : "var(--ink)",
                  background: prefs.oddsFormat === o.value ? "var(--brand)" : "var(--bg-soft)",
                  border: "1px solid var(--line)",
                  borderRadius: 8,
                  padding: "4px 10px",
                  cursor: "pointer",
                  transition: "background .12s",
                  whiteSpace: "nowrap" as const,
                }}
              >
                {o.label}
              </button>
            ))}
          </div>
        </SettingsRow>
      </SettingsSection>

      {/* Notifications */}
      <SettingsSection title="Notifications">
        <p style={{ margin: 0, fontSize: 12, color: "var(--muted-2)", lineHeight: 1.5 }}>
          Preferences are stored. Push delivery is coming soon; toggles are live for when the system
          is enabled.
        </p>
        {(
          [
            {
              key: "betFilled",
              label: "Bet filled",
              sub: "When a prediction market order executes",
            },
            { key: "orderFilled", label: "Order filled", sub: "When a swap or VL order fills" },
            {
              key: "marketResolves",
              label: "Market resolves",
              sub: "When a prediction market settles",
            },
            { key: "p2p", label: "P2P activity", sub: "When a P2P intent is matched or filled" },
          ] as const
        ).map(({ key, label, sub }) => (
          <SettingsRow key={key} label={label} sub={sub} badge={<ComingSoonBadge />}>
            <Toggle
              checked={prefs.notifications[key]}
              onChange={(v) => update({ notifications: { ...prefs.notifications, [key]: v } })}
            />
          </SettingsRow>
        ))}
      </SettingsSection>

      {/* Reset */}
      <div style={{ textAlign: "right" }}>
        <button
          type="button"
          onClick={() => {
            if (typeof window !== "undefined") {
              window.localStorage.removeItem(`${process.env.NEXT_PUBLIC_STORAGE_NS ?? "predfx"}.account.prefs.v1`);
            }
            const defaults = { ...DEFAULT_PREFS };
            setPrefs(defaults);
            setCustomSlippage("");
            setSaved(true);
            setTimeout(() => setSaved(false), 1500);
          }}
          style={{
            fontFamily: "var(--f-tech)",
            fontSize: 11,
            color: "var(--muted-2)",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
            textDecoration: "underline",
          }}
        >
          Reset to defaults
        </button>
      </div>
    </div>
  );
}

import type React from "react";
