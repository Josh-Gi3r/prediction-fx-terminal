"use client";

import type { WcBookLevel } from "@/lib/wc2026/usePm";
import { fmtCents, fmtDollar, fmtShares } from "./helpers";

export interface OrderBookProps {
  bids: WcBookLevel[];
  asks: WcBookLevel[];
  bestBid: number | null;
  bestAsk: number | null;
}

function depthBar(fraction: number, side: "ask" | "bid"): React.CSSProperties {
  const color = side === "ask" ? "var(--no-soft)" : "var(--yes-soft)";
  return {
    background: `linear-gradient(to left, ${color} ${(fraction * 100).toFixed(1)}%, transparent ${(fraction * 100).toFixed(1)}%)`,
  };
}

export function OrderBook({ bids, asks, bestBid, bestAsk }: OrderBookProps) {
  // Show top 8 of each side
  const topAsks = asks.slice(0, 8);
  const topBids = bids.slice(0, 8);

  // Cumulative totals for depth bar
  const askTotals = topAsks.map((l) => Number(l.price) * Number(l.size));
  const bidTotals = topBids.map((l) => Number(l.price) * Number(l.size));
  const maxAsk = Math.max(...askTotals, 1);
  const maxBid = Math.max(...bidTotals, 1);

  const spread = bestAsk != null && bestBid != null ? ((bestAsk - bestBid) * 100).toFixed(0) : null;

  const colStyle: React.CSSProperties = {
    fontFamily: "var(--f-tech)",
    fontSize: 12.5,
    fontVariantNumeric: "tabular-nums",
  };

  const headerStyle: React.CSSProperties = {
    fontFamily: "var(--f-tech)",
    fontSize: 10,
    letterSpacing: ".1em",
    textTransform: "uppercase" as const,
    color: "var(--muted-2)",
    padding: "6px 8px",
  };

  return (
    <div
      style={{
        border: "1px solid var(--line)",
        borderRadius: "var(--r)",
        overflow: "hidden",
        background: "#fff",
      }}
    >
      {/* Column headers */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          borderBottom: "1px solid var(--line)",
          background: "var(--bg-soft)",
        }}
        aria-label="Order book columns"
      >
        <span style={headerStyle}>Price</span>
        <span style={{ ...headerStyle, textAlign: "right" }}>Shares</span>
        <span style={{ ...headerStyle, textAlign: "right" }}>Total</span>
      </div>

      {/* Asks label */}
      <div
        style={{
          padding: "4px 8px",
          background: "var(--no-soft)",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <span
          style={{
            fontFamily: "var(--f-tech)",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: ".1em",
            textTransform: "uppercase",
            color: "var(--no)",
          }}
        >
          Asks
        </span>
      </div>

      {/* Ask rows (highest first = top of book further from mid) */}
      {topAsks.length === 0 ? (
        <div
          style={{
            padding: "14px 10px",
            fontFamily: "var(--f-tech)",
            fontSize: 12,
            color: "var(--muted-2)",
            textAlign: "center",
          }}
        >
          No ask orders
        </div>
      ) : (
        [...topAsks].reverse().map((level, i) => {
          const price = Number(level.price);
          const size = Number(level.size);
          const total = price * size;
          // Index from end = reversed
          const origIdx = topAsks.length - 1 - i;
          const fraction = (askTotals[origIdx] ?? 0) / maxAsk;
          return (
            <div
              key={`ask-${level.price}-${level.size}`}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                padding: "5px 8px",
                borderBottom: "1px solid var(--line)",
                position: "relative",
                ...depthBar(fraction, "ask"),
              }}
              aria-label={`Ask ${fmtCents(price)} × ${fmtShares(size)}`}
            >
              <span style={{ ...colStyle, color: "var(--no)", fontWeight: 700 }}>
                {fmtCents(price)}
              </span>
              <span style={{ ...colStyle, textAlign: "right", color: "var(--ink)" }}>
                {fmtShares(size)}
              </span>
              <span style={{ ...colStyle, textAlign: "right", color: "var(--muted)" }}>
                {fmtDollar(total)}
              </span>
            </div>
          );
        })
      )}

      {/* Spread / Last divider */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          padding: "5px 8px",
          background: "var(--bg-soft)",
          borderTop: "1px solid var(--line)",
          borderBottom: "1px solid var(--line)",
        }}
        aria-label="Spread and last price"
      >
        <span
          style={{
            fontFamily: "var(--f-tech)",
            fontSize: 11,
            color: "var(--muted)",
          }}
        >
          Last: {bestAsk != null ? fmtCents(bestAsk) : "—"}
        </span>
        <span
          style={{
            fontFamily: "var(--f-tech)",
            fontSize: 11,
            color: "var(--muted)",
            textAlign: "right",
          }}
        >
          Spread: {spread != null ? `${spread}¢` : "—"}
        </span>
      </div>

      {/* Bids label */}
      <div
        style={{
          padding: "4px 8px",
          background: "var(--yes-soft)",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <span
          style={{
            fontFamily: "var(--f-tech)",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: ".1em",
            textTransform: "uppercase",
            color: "var(--yes)",
          }}
        >
          Bids
        </span>
      </div>

      {/* Bid rows */}
      {topBids.length === 0 ? (
        <div
          style={{
            padding: "14px 10px",
            fontFamily: "var(--f-tech)",
            fontSize: 12,
            color: "var(--muted-2)",
            textAlign: "center",
          }}
        >
          No bid orders
        </div>
      ) : (
        topBids.map((level, i) => {
          const price = Number(level.price);
          const size = Number(level.size);
          const total = price * size;
          const fraction = (bidTotals[i] ?? 0) / maxBid;
          return (
            <div
              key={`bid-${level.price}-${level.size}`}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                padding: "5px 8px",
                borderBottom: "1px solid var(--line)",
                position: "relative",
                ...depthBar(fraction, "bid"),
              }}
              aria-label={`Bid ${fmtCents(price)} × ${fmtShares(size)}`}
            >
              <span style={{ ...colStyle, color: "var(--yes)", fontWeight: 700 }}>
                {fmtCents(price)}
              </span>
              <span style={{ ...colStyle, textAlign: "right", color: "var(--ink)" }}>
                {fmtShares(size)}
              </span>
              <span style={{ ...colStyle, textAlign: "right", color: "var(--muted)" }}>
                {fmtDollar(total)}
              </span>
            </div>
          );
        })
      )}
    </div>
  );
}
