"use client";

import { Sparkline } from "@/components/ui/sparkline";
import { type Corridor, realisticYesProb, spreadBps } from "@/lib/corridors/registry";
import { useFxRate } from "@/lib/fx-provider/hooks";
import { useUiStore } from "@/stores/ui";
import { motion } from "motion/react";
import { useMemo } from "react";

function fmtRate(r: number): string {
  if (r >= 100) return r.toFixed(2);
  if (r >= 10) return r.toFixed(3);
  return r.toFixed(4);
}

interface Props {
  corridor: Corridor;
  index: number;
}

/** Shared button style for LONG/SHORT — mirrors design.css .yn button sizing */
const perpBtnBase: React.CSSProperties = {
  fontFamily: "var(--f-tech)",
  fontWeight: 700,
  fontSize: 13,
  padding: "11px 8px",
  borderRadius: 10,
  border: "1px solid transparent",
  cursor: "pointer",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 2,
  transition: "background .15s, color .15s",
  flex: 1,
};

export function CorridorCard({ corridor, index }: Props) {
  const instrument = useUiStore((s) => s.instrument);
  const openDrawer = useUiStore((s) => s.openDrawer);
  const yesProb = useMemo(
    () => realisticYesProb(corridor.basis, corridor.seed),
    [corridor.basis, corridor.seed],
  );

  // Live data — falls back to registry snapshot on error or while loading.
  const fx = useFxRate(corridor.isoBase, corridor.isoQuote);
  const liveRate = fx.data ? Number.parseFloat(fx.data.rate) : null;
  const liveChg = fx.data?.change_pct != null ? Number.parseFloat(fx.data.change_pct) : null;

  const mark = liveRate ?? corridor.refRate;
  const chg = liveChg ?? corridor.refChg;
  const positive = chg >= 0;
  const spread = spreadBps(corridor.tier);
  const bid = mark * (1 - spread / 20000);
  const ask = mark * (1 + spread / 20000);
  const isLive = liveRate !== null;

  const isDeliverable = instrument === "deliverable";
  const badgeBg = isDeliverable ? "var(--yes-soft)" : "var(--bg-tint)";
  const badgeColor = isDeliverable ? "var(--yes)" : "var(--brand)";
  const badgeBorder = isDeliverable ? "rgba(19,185,129,.3)" : "var(--line)";

  return (
    <motion.div
      id={corridor.sym.replace("/", "-")}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.32, delay: Math.min(index, 6) * 0.04 }}
      style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: "var(--r-lg)",
        padding: 18,
        boxShadow: "var(--sh-1)",
        position: "relative",
        overflow: "hidden",
      }}
      whileHover={{
        y: -3,
        boxShadow: "var(--sh-2)",
        borderColor: "var(--line-2)",
      }}
    >
      {/* Top row: pair + badge + issuer */}
      <div style={{ marginBottom: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {/* Pip */}
          <span
            style={{
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: "var(--grad-brand)",
              flexShrink: 0,
              display: "inline-block",
            }}
          />
          <span
            style={{
              fontFamily: "var(--f-tech)",
              fontWeight: 700,
              fontSize: 16,
              color: "var(--ink)",
            }}
          >
            {corridor.sym}
          </span>
          <span
            style={{
              fontFamily: "var(--f-tech)",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: badgeColor,
              background: badgeBg,
              padding: "3px 8px",
              borderRadius: 6,
              border: `1px solid ${badgeBorder}`,
              whiteSpace: "nowrap",
            }}
          >
            {isDeliverable ? "Deliverable" : `Perp · ${corridor.maxLev}×`}
          </span>
        </div>
        <div
          style={{
            marginTop: 2,
            fontSize: 12.5,
            color: "var(--muted)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {corridor.name} · {corridor.issuer}
        </div>
      </div>

      {/* Sparkline */}
      <div style={{ height: 42, margin: "10px 0 8px" }}>
        <Sparkline
          data={[]}
          seed={corridor.seed + 3}
          width={240}
          height={42}
          tone={positive ? "green" : "red"}
          filled
        />
      </div>

      {/* Price row */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span
            className="mono"
            style={{
              fontFamily: "var(--f-display)",
              fontWeight: 800,
              fontSize: 24,
              letterSpacing: "-0.01em",
              color: "var(--ink)",
            }}
          >
            {fmtRate(mark)}
          </span>
          <span
            className="mono"
            style={{
              fontWeight: 700,
              fontSize: 13,
              color: positive ? "var(--up)" : "var(--down)",
            }}
          >
            {positive ? "+" : ""}
            {chg.toFixed(2)}%
          </span>
          {isLive && (
            <span
              aria-label="Live price"
              title="Live oracle rate"
              style={{
                display: "inline-block",
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "var(--brand)",
                animation: "pulse 1.8s infinite",
                marginLeft: 2,
              }}
            />
          )}
        </div>
        {!isDeliverable && (
          <span
            style={{
              fontFamily: "var(--f-tech)",
              fontSize: 10,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--muted)",
            }}
          >
            spread {spread} bps
          </span>
        )}
      </div>

      {/* Body copy + action buttons */}
      {isDeliverable ? (
        <>
          <p
            style={{
              fontSize: 13,
              color: "var(--ink-2)",
              lineHeight: 1.4,
              marginBottom: 12,
              minHeight: 34,
            }}
          >
            Will {corridor.isoQuote}/{corridor.isoBase} settle below{" "}
            <span className="mono" style={{ color: "var(--ink)" }}>
              {fmtRate(mark)}
            </span>{" "}
            at expiry?
          </p>
          {/* Use .yn design.css class — .yes and .no exist */}
          <div className="yn">
            <button
              type="button"
              className="yes"
              onClick={() => openDrawer({ corridorSym: corridor.sym, side: "yes" })}
            >
              YES
              <small>{Math.round(yesProb * 100)}¢</small>
            </button>
            <button
              type="button"
              className="no"
              onClick={() => openDrawer({ corridorSym: corridor.sym, side: "no" })}
            >
              NO
              <small>{Math.round((1 - yesProb) * 100)}¢</small>
            </button>
          </div>
        </>
      ) : (
        <>
          <p
            style={{
              fontSize: 12.5,
              color: "var(--ink-2)",
              lineHeight: 1.4,
              marginBottom: 12,
            }}
          >
            Funding{" "}
            <strong
              style={{
                color: corridor.fundingRate >= 0 ? "var(--up)" : "var(--down)",
              }}
            >
              {corridor.fundingRate >= 0 ? "+" : ""}
              {(corridor.fundingRate * 100).toFixed(4)}% / 8h
            </strong>{" "}
            · Cash-settled · up to {corridor.maxLev}×
          </p>
          {/* Inline-styled LONG/SHORT — no .long/.short class in design.css */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <button
              type="button"
              style={{
                ...perpBtnBase,
                background: "var(--yes-soft)",
                color: "var(--yes)",
              }}
              onClick={() => openDrawer({ corridorSym: corridor.sym, side: "long" })}
            >
              LONG
              <small style={{ fontWeight: 600, fontSize: 10, opacity: 0.8 }}>
                {corridor.maxLev}× max
              </small>
            </button>
            <button
              type="button"
              style={{
                ...perpBtnBase,
                background: "var(--no-soft)",
                color: "var(--no)",
              }}
              onClick={() => openDrawer({ corridorSym: corridor.sym, side: "short" })}
            >
              SHORT
              <small style={{ fontWeight: 600, fontSize: 10, opacity: 0.8 }}>
                {corridor.maxLev}× max
              </small>
            </button>
          </div>
        </>
      )}
    </motion.div>
  );
}
