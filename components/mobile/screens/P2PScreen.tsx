"use client";

/**
 * components/mobile/screens/P2PScreen.tsx
 * Shell ≤300 lines. Panel logic lives in components/mobile/p2p/.
 *
 * Tabs:
 *   sell     → SellPanel (sell / send sub-tabs)
 *   rates    → MobileRatesPanel
 *   activity → MobileActivityPanel
 *
 * The picker sub-screen is managed here because it replaces the whole screen.
 */

import { MobileActivityPanel } from "@/components/mobile/p2p/ActivityPanel";
import { MobileRatesPanel } from "@/components/mobile/p2p/RatesPanel";
import { SellPanel } from "@/components/mobile/p2p/SellPanel";
import { useLiveRates } from "@/components/mobile/p2p/shared";
import { useRef, useState } from "react";
import { Icon } from "../Icon";

interface Picker {
  title: string;
  items: { value: string; ic: React.ReactNode; t: string; s?: string }[];
  cb: (v: string) => void;
}

type MainTab = "sell" | "rates" | "activity";

interface P2PScreenProps {
  onToast: (msg: string) => void;
}

export function P2PScreen({ onToast }: P2PScreenProps) {
  const scRef = useRef<HTMLDivElement>(null);
  const toTop = () => scRef.current?.scrollTo({ top: 0, behavior: "smooth" });

  const [mainTab, setMainTab] = useState<MainTab>("sell");
  const [picker, setPicker] = useState<Picker | null>(null);
  const [pickerQ, setPickerQ] = useState("");

  const { rates: liveRates, loading: ratesLoading } = useLiveRates();

  // ── Picker sub-screen ──────────────────────────────────────────────────────
  if (picker) {
    const f = pickerQ.trim().toLowerCase();
    const list = picker.items.filter(
      (it) => !f || it.t.toLowerCase().includes(f) || (it.s ?? "").toLowerCase().includes(f),
    );
    return (
      <div className="screen fade-in">
        <div className="appbar">
          <button
            type="button"
            className="iconbtn"
            onClick={() => {
              setPicker(null);
              setPickerQ("");
            }}
            aria-label="Back"
          >
            <Icon name="back" size={20} />
          </button>
          <div className="ab-title" style={{ fontSize: 20 }}>
            {picker.title}
          </div>
        </div>
        {picker.items.length > 6 && (
          <div
            style={{
              margin: "0 18px 12px",
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: "#fff",
              border: "1px solid var(--line)",
              borderRadius: 12,
              padding: "11px 13px",
            }}
          >
            <Icon name="search" size={18} color="var(--muted-2)" />
            <input
              value={pickerQ}
              onChange={(e) => setPickerQ(e.target.value)}
              placeholder="Search…"
              style={{
                flex: 1,
                border: 0,
                outline: "none",
                background: "none",
                fontFamily: "var(--f-ui)",
                fontSize: 15,
              }}
            />
          </div>
        )}
        <div className="listwrap">
          {list.map((it) => (
            <div
              className="pk-row"
              key={String(it.value)}
              style={{ padding: "13px 15px" }}
              onClick={() => {
                const cb = picker.cb;
                setPicker(null);
                setPickerQ("");
                cb(it.value);
              }}
            >
              {it.ic}
              <div style={{ minWidth: 0 }}>
                <div className="sy">{it.t}</div>
                {it.s && <div className="nm">{it.s}</div>}
              </div>
            </div>
          ))}
          {list.length === 0 && (
            <div
              style={{ padding: 30, textAlign: "center", color: "var(--muted-2)", fontSize: 13 }}
            >
              No matches.
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="screen fade-in" ref={scRef}>
      {/* ── App bar ── */}
      <div className="appbar">
        <div>
          <div className="eyebrow" style={{ marginBottom: 4 }}>
            <span className="tick" />
            P2P · non-custodial
          </div>
          <div className="ab-title">P2P Cash</div>
        </div>
        <span className="grow" />
        <button
          type="button"
          className="iconbtn"
          onClick={() => onToast("Order history · nothing pending")}
          aria-label="History"
        >
          <Icon name="clock" size={20} />
        </button>
      </div>

      {/* ── Hero description ── */}
      <div
        style={{
          margin: "0 18px 14px",
          fontSize: 12.5,
          color: "var(--muted)",
          lineHeight: 1.55,
        }}
      >
        Off-ramp your stables straight into your account. Venmo, CashApp, Revolut, Wise and many
        more.
      </div>

      {/* ── Main tabs: SELL · RATES · ACTIVITY ── */}
      <div
        style={{
          display: "flex",
          margin: "0 18px 16px",
          background: "var(--bg-soft)",
          borderRadius: 12,
          padding: 3,
          gap: 2,
        }}
      >
        {(["sell", "rates", "activity"] as MainTab[]).map((t) => (
          <button
            type="button"
            key={t}
            onClick={() => setMainTab(t)}
            style={{
              flex: 1,
              padding: "8px 4px",
              borderRadius: 9,
              border: "none",
              background: mainTab === t ? "#fff" : "none",
              color: mainTab === t ? "var(--ink)" : "var(--muted)",
              fontFamily: "var(--f-tech)",
              fontSize: 11,
              fontWeight: mainTab === t ? 800 : 600,
              letterSpacing: ".06em",
              textTransform: "uppercase" as const,
              cursor: "pointer",
              boxShadow: mainTab === t ? "0 1px 4px rgba(11,20,55,.08)" : "none",
              transition: ".15s",
            }}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {/* ══════════════ SELL TAB ══════════════ */}
      {mainTab === "sell" && (
        <SellPanel
          onToast={onToast}
          liveRates={liveRates}
          ratesLoading={ratesLoading}
          picker={picker}
          setPicker={setPicker}
          pickerQ={pickerQ}
          setPickerQ={setPickerQ}
        />
      )}

      {/* ══════════════ RATES TAB ══════════════ */}
      {mainTab === "rates" && (
        <div style={{ paddingBottom: 20 }}>
          <MobileRatesPanel />
        </div>
      )}

      {/* ══════════════ ACTIVITY TAB ══════════════ */}
      {mainTab === "activity" && (
        <div style={{ paddingBottom: 20 }}>
          <MobileActivityPanel liveRates={liveRates} ratesLoading={ratesLoading} />
        </div>
      )}

      {/* ── Footer note ── */}
      <div
        style={{
          display: "flex",
          gap: 9,
          margin: "0 18px 80px",
          color: "var(--muted)",
          fontSize: 11.5,
          lineHeight: 1.5,
        }}
      >
        <Icon name="info" size={15} color="var(--accent-2)" />
        <span>
          Funds sit in onchain escrow you control. Fiat moves directly between bank apps; zk payment
          proofs release escrow. This app never custodies your money.
        </span>
      </div>
    </div>
  );
}
