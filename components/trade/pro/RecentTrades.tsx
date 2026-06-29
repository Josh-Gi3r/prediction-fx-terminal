"use client";

import type { RecentTrade } from "@/lib/orderbook/genBook";

function fmtPrice(p: number): string {
  if (p >= 100) return p.toFixed(2);
  if (p >= 10) return p.toFixed(3);
  return p.toFixed(4);
}

function fmtTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function fmtSize(s: number): string {
  if (s >= 1_000_000) return `${(s / 1_000_000).toFixed(2)}M`;
  if (s >= 1_000) return `${(s / 1_000).toFixed(1)}K`;
  return s.toFixed(0);
}

export function RecentTrades({ trades }: { trades: RecentTrade[] }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: "var(--r-lg)",
        boxShadow: "var(--sh-1)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          borderBottom: "1px solid var(--line)",
          padding: "9px 12px",
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
          Recent trades
        </span>
        {/* Honesty label */}
        <span
          style={{
            fontFamily: "var(--f-tech)",
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--muted-2)",
            background: "var(--bg-tint)",
            border: "1px solid var(--line)",
            padding: "1px 6px",
            borderRadius: 4,
          }}
        >
          Simulated preview
        </span>
      </div>

      {/* Column headers */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          padding: "6px 12px",
          fontFamily: "var(--f-tech)",
          fontSize: 10,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--muted-2)",
        }}
      >
        <span>Time</span>
        <span style={{ textAlign: "right" }}>Price</span>
        <span style={{ textAlign: "right" }}>Size</span>
      </div>

      {/* Rows */}
      <div style={{ maxHeight: 320, overflowY: "auto" }}>
        {trades.map((t) => (
          <div
            key={`${t.ts}-${t.price}`}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              padding: "4px 12px",
              fontSize: 12,
            }}
          >
            <span className="mono" style={{ color: "var(--muted)" }}>
              {fmtTime(t.ts)}
            </span>
            <span
              className="mono"
              style={{
                textAlign: "right",
                color: t.side === "buy" ? "var(--yes)" : "var(--no)",
              }}
            >
              {fmtPrice(t.price)}
            </span>
            <span className="mono" style={{ textAlign: "right", color: "var(--ink-2)" }}>
              {fmtSize(t.size)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
