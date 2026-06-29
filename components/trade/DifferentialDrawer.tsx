"use client";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { type Corridor, spreadBps } from "@/lib/corridors/registry";
import { useUiStore } from "@/stores/ui";
import { AlertTriangle, ArrowLeftRight } from "lucide-react";
import { useState } from "react";

function fmtRate(r: number): string {
  if (r >= 100) return r.toFixed(2);
  if (r >= 10) return r.toFixed(3);
  return r.toFixed(4);
}

interface Props {
  corridor: Corridor;
}

const CCY_PRESETS = [
  "USDC",
  "USDT",
  "EURC",
  "BRLV",
  "MXNB",
  "IDRT",
  "JPYC",
  "XSGD",
  "TRYB",
] as const;

function useLocalLeverage(initial: number, max: number) {
  const [v, setV] = useState(Math.min(initial, max));
  return [v, (n: number) => setV(Math.max(1, Math.min(max, n)))] as const;
}

export function DifferentialDrawer({ corridor }: Props) {
  const side = useUiStore((s) => s.drawer.side);
  const sizeRaw = useUiStore((s) => s.drawer.sizeRaw);
  const marginCcy = useUiStore((s) => s.drawer.marginCcy) ?? "USDC";
  const setDrawerSide = useUiStore((s) => s.setDrawerSide);
  const setDrawerSize = useUiStore((s) => s.setDrawerSize);
  const setDrawerMarginCcy = useUiStore((s) => s.setDrawerMarginCcy);
  const closeDrawer = useUiStore((s) => s.closeDrawer);

  const [lev, setLev] = useLocalLeverage(10, corridor.maxLev);

  const isLong = side === "long";
  const size = Number.parseFloat(sizeRaw) || 0;

  const spread = spreadBps(corridor.tier);
  const mark = corridor.refRate;
  const bid = mark * (1 - spread / 20000);
  const ask = mark * (1 + spread / 20000);
  const entry = isLong ? ask : bid;

  const notional = size * lev;
  const liqMove = 0.95 / lev;
  const liqPrice = isLong ? entry * (1 - liqMove) : entry * (1 + liqMove);
  const liqDistancePct = (Math.abs(liqPrice - mark) / mark) * 100;
  const fundingDirection = corridor.fundingRate >= 0 ? "Longs pay shorts" : "Shorts pay longs";

  const pnlAt = (movePct: number): number => {
    const dir = isLong ? 1 : -1;
    return notional * (movePct / 100) * dir;
  };

  const sizePresets = [25, 100, 500, 1000];
  const levPresets = [2, 5, 10, 25, 50, 100].filter((l) => l <= corridor.maxLev);
  const highLev = lev >= corridor.maxLev * 0.7;
  // Waitlist capture — FX perp order path not yet live-tested; gated until verified.
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistSent, setWaitlistSent] = useState(false);
  const [waitlistPending, setWaitlistPending] = useState(false);

  function confirm() {
    toast.info({
      title: `${isLong ? "LONG" : "SHORT"} ${lev}× · ${corridor.sym}`,
      description: `${size.toFixed(2)} ${marginCcy} margin · ${notional.toFixed(2)} ${marginCcy} notional · settles ${marginCcy} onchain`,
    });
    closeDrawer();
  }

  return (
    <div style={{ display: "flex", height: "100%", flexDirection: "column" }}>
      {/* Header */}
      <header
        style={{
          borderBottom: "1px solid var(--line)",
          padding: "24px 24px 18px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontFamily: "var(--f-tech)",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "#fff",
              background: "var(--grad-brand)",
              padding: "3px 9px",
              borderRadius: 6,
            }}
          >
            Perp · up to {corridor.maxLev}×
          </span>
          <span
            style={{
              fontFamily: "var(--f-tech)",
              fontWeight: 700,
              fontSize: 15,
              color: "var(--ink)",
            }}
          >
            {corridor.sym}
          </span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 10,
            marginTop: 10,
          }}
        >
          <span className="mono" style={{ fontSize: 30, fontWeight: 700, color: "var(--ink)" }}>
            {fmtRate(mark)}
          </span>
          <span style={{ fontSize: 11, color: "var(--muted)" }}>
            spread {spread} bps · bid {fmtRate(bid)} · ask {fmtRate(ask)}
          </span>
        </div>
      </header>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
        {/* LONG / SHORT toggle */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <button
            type="button"
            onClick={() => setDrawerSide("long")}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 3,
              borderRadius: 12,
              border: side === "long" ? "1px solid rgba(19,185,129,.5)" : "1px solid var(--line)",
              background: side === "long" ? "rgba(19,185,129,.08)" : "#fff",
              padding: 12,
              textAlign: "left",
              cursor: "pointer",
              transition: "border-color .15s, background .15s",
            }}
          >
            <span style={{ fontSize: 12, color: "var(--muted)" }}>LONG · pay ask</span>
            <span className="mono" style={{ fontSize: 20, fontWeight: 700, color: "var(--yes)" }}>
              {fmtRate(ask)}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setDrawerSide("short")}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 3,
              borderRadius: 12,
              border: side === "short" ? "1px solid rgba(240,67,106,.5)" : "1px solid var(--line)",
              background: side === "short" ? "rgba(240,67,106,.08)" : "#fff",
              padding: 12,
              textAlign: "left",
              cursor: "pointer",
              transition: "border-color .15s, background .15s",
            }}
          >
            <span style={{ fontSize: 12, color: "var(--muted)" }}>SHORT · receive bid</span>
            <span className="mono" style={{ fontSize: 20, fontWeight: 700, color: "var(--no)" }}>
              {fmtRate(bid)}
            </span>
          </button>
        </div>

        {/* Margin input */}
        <div style={{ marginTop: 20 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <span
              style={{
                fontFamily: "var(--f-tech)",
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--muted)",
              }}
            >
              Margin
            </span>
            <CcyPicker value={marginCcy} onChange={(v) => setDrawerMarginCcy(v)} />
          </div>
          <input
            type="text"
            inputMode="decimal"
            value={String(size || "")}
            placeholder="0"
            onChange={(e) => setDrawerSize(e.target.value.replace(/[^0-9.]/g, ""))}
            style={{
              fontFamily: "var(--f-tech)",
              width: "100%",
              borderRadius: 10,
              border: "1px solid var(--line)",
              background: "var(--bg-soft)",
              padding: "10px 12px",
              fontSize: 20,
              fontWeight: 600,
              color: "var(--ink)",
              outline: "none",
            }}
          />
          <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
            {sizePresets.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setDrawerSize(String(p))}
                style={{
                  borderRadius: 999,
                  background: "var(--bg-tint)",
                  border: "1px solid var(--line)",
                  padding: "5px 12px",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--ink-2)",
                  cursor: "pointer",
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Leverage slider */}
        <div style={{ marginTop: 20 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <span
              style={{
                fontFamily: "var(--f-tech)",
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--muted)",
              }}
            >
              Leverage
            </span>
            <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
              {lev}×
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={corridor.maxLev}
            step={1}
            value={lev}
            onChange={(e) => setLev(Number.parseInt(e.target.value, 10))}
            style={{ width: "100%", accentColor: "var(--brand)" }}
          />
          <div
            style={{
              marginTop: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: 10,
              color: "var(--muted)",
            }}
          >
            <span>1×</span>
            <span>
              Max: {corridor.maxLev}× · {corridor.tier}
            </span>
            <span>{corridor.maxLev}×</span>
          </div>
          <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
            {levPresets.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLev(l)}
                style={{
                  borderRadius: 999,
                  background: lev === l ? "var(--navy)" : "var(--bg-tint)",
                  border: "1px solid var(--line)",
                  padding: "5px 12px",
                  fontSize: 11,
                  fontWeight: 600,
                  color: lev === l ? "#fff" : "var(--ink-2)",
                  cursor: "pointer",
                  transition: "background .15s, color .15s",
                }}
              >
                {l}×
              </button>
            ))}
          </div>
        </div>

        {/* P&L summary */}
        <div
          style={{
            marginTop: 20,
            borderRadius: 12,
            border: "1px solid var(--line)",
            background: "var(--bg-soft)",
            padding: 16,
          }}
        >
          <DRow label="Notional" value={`${notional.toFixed(2)} ${marginCcy}`} />
          <DRow label="Entry rate" value={fmtRate(entry)} />
          <DRow label="Mark" value={fmtRate(mark)} />
          <DRow
            label="If rate moves +1%"
            value={`${pnlAt(1) >= 0 ? "+" : ""}${pnlAt(1).toFixed(2)} ${marginCcy}`}
            tone={pnlAt(1) >= 0 ? "green" : "red"}
            accent
          />
          <DRow
            label="If rate moves +5%"
            value={`${pnlAt(5) >= 0 ? "+" : ""}${pnlAt(5).toFixed(2)} ${marginCcy}`}
            tone={pnlAt(5) >= 0 ? "green" : "red"}
          />
        </div>

        {/* Liquidation bar */}
        <div
          style={{
            marginTop: 14,
            borderRadius: 12,
            border: "1px solid var(--line)",
            background: "var(--bg-soft)",
            padding: 12,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: 11,
              marginBottom: 8,
            }}
          >
            <span style={{ color: "var(--muted)" }}>Liquidation price</span>
            <span className="mono" style={{ fontWeight: 600, color: "var(--no)" }}>
              {fmtRate(liqPrice)} · {liqDistancePct.toFixed(2)}% away
            </span>
          </div>
          <div
            style={{
              position: "relative",
              height: 6,
              borderRadius: 999,
              background: "var(--line)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                insetBlock: 0,
                background: "var(--no)",
                width: `${Math.min(50, liqDistancePct * 2)}%`,
                ...(isLong ? { left: 0 } : { right: 0 }),
              }}
            />
            <div
              style={{
                position: "absolute",
                insetBlock: 0,
                left: "50%",
                width: 1,
                background: "var(--line-2)",
              }}
            />
          </div>
          <div
            style={{
              marginTop: 4,
              display: "flex",
              justifyContent: "space-between",
              fontSize: 10,
              color: "var(--muted)",
            }}
          >
            <span>{isLong ? "LIQ" : "MARK"}</span>
            <span>MARK</span>
            <span>{isLong ? "MARK" : "LIQ"}</span>
          </div>
        </div>

        {/* Funding row */}
        <div
          style={{
            marginTop: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderRadius: 12,
            border: "1px solid var(--line)",
            background: "var(--bg-soft)",
            padding: "10px 12px",
            fontSize: 11,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                display: "inline-block",
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "var(--brand)",
                animation: "pulse 1.8s infinite",
              }}
            />
            <span style={{ color: "var(--muted)" }}>Funding</span>
          </div>
          <span className="mono">
            {corridor.fundingRate >= 0 ? "+" : ""}
            {(corridor.fundingRate * 100).toFixed(4)}% / 8h · {fundingDirection}
          </span>
        </div>

        {/* Settlement note */}
        <div
          style={{
            marginTop: 10,
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            borderRadius: 12,
            border: "1px solid rgba(19,185,129,.3)",
            background: "rgba(19,185,129,.05)",
            padding: 12,
          }}
        >
          <ArrowLeftRight size={14} style={{ flexShrink: 0, marginTop: 1, color: "var(--yes)" }} />
          <p style={{ margin: 0, fontSize: 11, lineHeight: 1.55, color: "var(--ink-2)" }}>
            Your P&amp;L settles in{" "}
            <span style={{ fontWeight: 600, color: "var(--ink)" }}>{marginCcy}</span>. Settlement
            converts at the onchain oracle rate. No manual conversion, no spread loss.
          </p>
        </div>

        {/* High leverage warning */}
        {highLev && (
          <div
            style={{
              marginTop: 10,
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              borderRadius: 12,
              border: "1px solid rgba(234,179,8,.3)",
              background: "rgba(234,179,8,.06)",
              padding: 12,
            }}
          >
            <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1, color: "#ca8a04" }} />
            <p style={{ margin: 0, fontSize: 11, lineHeight: 1.55, color: "var(--ink-2)" }}>
              <span style={{ fontWeight: 600, color: "var(--ink)" }}>High leverage.</span> {lev}×
              liquidates on a {(100 / lev).toFixed(2)}% adverse move. Funding accrues every 8h.
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer
        style={{
          borderTop: "1px solid var(--line)",
          padding: "16px 24px",
        }}
      >
        {/* Waitlist capture — FX perp order path is wired in confirm() above but
            gated here until it has been verified end-to-end on mainnet. */}
        <div
          style={{
            marginBottom: 10,
            borderRadius: 8,
            border: "1px solid rgba(234,179,8,.3)",
            background: "rgba(234,179,8,.08)",
            padding: "10px 12px",
          }}
        >
          <div
            style={{
              fontFamily: "var(--f-tech)",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: ".1em",
              textTransform: "uppercase",
              color: "#92400e",
              marginBottom: 8,
            }}
          >
            Coming soon · FX Perps
          </div>
          {waitlistSent ? (
            <p style={{ margin: 0, fontSize: 12, color: "var(--yes)", textAlign: "center" }}>
              Got it. We will notify you when FX perps go live.
            </p>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const email = waitlistEmail.trim();
                if (!email) return;
                setWaitlistPending(true);
                try {
                  const res = await fetch("/api/waitlist", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, product: "predict-fx-perp" }),
                  });
                  if (res.ok) {
                    setWaitlistSent(true);
                    toast.success({
                      title: "You are on the waitlist",
                      description: "We will email you when FX perps open.",
                    });
                  } else {
                    toast.error({
                      title: "Could not join waitlist",
                      description: "Check your email and try again.",
                    });
                  }
                } catch {
                  toast.error({ title: "Network error", description: "Try again in a moment." });
                } finally {
                  setWaitlistPending(false);
                }
              }}
              style={{ display: "flex", gap: 6 }}
            >
              <input
                type="email"
                required
                value={waitlistEmail}
                onChange={(e) => setWaitlistEmail(e.target.value)}
                placeholder="your@email.com"
                style={{
                  flex: 1,
                  borderRadius: 8,
                  border: "1px solid var(--line)",
                  background: "#fff",
                  padding: "8px 10px",
                  fontSize: 13,
                  fontFamily: "var(--f-ui)",
                  color: "var(--ink)",
                  outline: "none",
                }}
              />
              <Button
                type="submit"
                variant={isLong ? "long" : "short"}
                size="sm"
                disabled={waitlistPending}
              >
                {waitlistPending ? "…" : "Notify me"}
              </Button>
            </form>
          )}
        </div>
        <p
          style={{
            marginTop: 8,
            textAlign: "center",
            fontSize: 10,
            color: "var(--muted)",
          }}
        >
          Settles onchain · any stablecoin · oracle-marked
        </p>
      </footer>
    </div>
  );
}

function DRow({
  label,
  value,
  accent,
  tone = "neutral",
}: {
  label: string;
  value: string;
  accent?: boolean;
  tone?: "neutral" | "green" | "red";
}) {
  const color = tone === "green" ? "var(--yes)" : tone === "red" ? "var(--no)" : "var(--ink)";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        fontSize: 12,
        marginBottom: 6,
      }}
    >
      <span style={{ color: "var(--muted)" }}>{label}</span>
      <span className="mono" style={{ fontWeight: accent ? 600 : 400, color }}>
        {value}
      </span>
    </div>
  );
}

function CcyPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        borderRadius: 6,
        background: "var(--bg-tint)",
        padding: "3px 8px",
        fontFamily: "var(--f-tech)",
        fontSize: 11,
        color: "var(--ink-2)",
        border: "1px solid var(--line)",
        outline: "none",
        cursor: "pointer",
      }}
      aria-label="Margin currency"
    >
      {CCY_PRESETS.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </select>
  );
}
