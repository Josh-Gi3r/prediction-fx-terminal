"use client";

import type { Book } from "@/lib/orderbook/genBook";

function fmtPrice(p: number): string {
  if (p >= 100) return p.toFixed(2);
  if (p >= 10) return p.toFixed(3);
  return p.toFixed(4);
}

function fmtSize(s: number): string {
  if (s >= 1_000_000) return `${(s / 1_000_000).toFixed(2)}M`;
  if (s >= 1_000) return `${(s / 1_000).toFixed(1)}K`;
  return s.toFixed(0);
}

export function OrderBook({ book }: { book: Book }) {
  const maxCum = Math.max(
    book.bids[book.bids.length - 1]?.cumSize ?? 0,
    book.asks[book.asks.length - 1]?.cumSize ?? 0,
  );

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
          justifyContent: "space-between",
          borderBottom: "1px solid var(--line)",
          padding: "9px 12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
            Order book
          </span>
          {/* Honesty label — data is seeded/simulated */}
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
        <span style={{ fontFamily: "var(--f-tech)", fontSize: 10, color: "var(--muted-2)" }}>
          {book.spreadBps} bps
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
        <span>Price</span>
        <span style={{ textAlign: "right" }}>Size</span>
        <span style={{ textAlign: "right" }}>Sum</span>
      </div>

      {/* Asks (reversed — highest at top in column, closest to mid at bottom) */}
      <div style={{ display: "flex", flexDirection: "column-reverse" }}>
        {book.asks.slice(0, 10).map((lvl) => (
          <BookRow key={`ask-${lvl.price}`} level={lvl} tone="ask" maxCum={maxCum} />
        ))}
      </div>

      {/* Mid price */}
      <div
        style={{
          borderTop: "1px solid var(--line)",
          borderBottom: "1px solid var(--line)",
          background: "var(--bg-soft)",
          padding: "8px 12px",
          textAlign: "center",
        }}
      >
        <span className="mono" style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>
          {fmtPrice(book.mid)}
        </span>
        <span
          style={{
            fontFamily: "var(--f-tech)",
            fontSize: 10,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--muted)",
            marginLeft: 8,
          }}
        >
          mid
        </span>
      </div>

      {/* Bids */}
      <div>
        {book.bids.slice(0, 10).map((lvl) => (
          <BookRow key={`bid-${lvl.price}`} level={lvl} tone="bid" maxCum={maxCum} />
        ))}
      </div>
    </div>
  );
}

function BookRow({
  level,
  tone,
  maxCum,
}: {
  level: { price: number; size: number; cumSize: number };
  tone: "bid" | "ask";
  maxCum: number;
}) {
  const widthPct = Math.min(100, (level.cumSize / maxCum) * 100);
  const depthBg = tone === "bid" ? "rgba(19,185,129,.10)" : "rgba(240,67,106,.10)";
  const priceColor = tone === "bid" ? "var(--yes)" : "var(--no)";

  return (
    <div
      style={{
        position: "relative",
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        padding: "4px 12px",
        fontSize: 12,
      }}
    >
      {/* Depth fill */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: "0 0 0 auto",
          background: depthBg,
          width: `${widthPct}%`,
        }}
      />
      <span className="mono" style={{ position: "relative", color: priceColor }}>
        {fmtPrice(level.price)}
      </span>
      <span
        className="mono"
        style={{ position: "relative", textAlign: "right", color: "var(--ink-2)" }}
      >
        {fmtSize(level.size)}
      </span>
      <span
        className="mono"
        style={{ position: "relative", textAlign: "right", color: "var(--muted)" }}
      >
        {fmtSize(level.cumSize)}
      </span>
    </div>
  );
}
