"use client";

/**
 * OrderbookPanel — live Peer USDC/fiat orderbook.
 *
 * Columns: Price (fiat per USDC) · Spread vs 1.0000 · Available USDC · Platform
 * Currency + platform filter row.
 */

import React from "react";

import { cn } from "@/lib/cn";
import { PEER_FIAT_CURRENCIES, PEER_PAYMENT_PLATFORMS } from "@/lib/peer/config";
import { peerPrice, peerUsdcAmount, usePeerOrderbook } from "@/lib/peer/quotes";

// ─── helpers ─────────────────────────────────────────────────────────────────

function spreadVsOne(price: string): { pct: string; positive: boolean } {
  const p = peerPrice(price);
  if (p == null) return { pct: "—", positive: false };
  const diff = (p - 1) * 100;
  return {
    pct: `${diff >= 0 ? "+" : ""}${diff.toFixed(2)}%`,
    positive: diff >= 0,
  };
}

function fmtUsdc(amount: string): string {
  const n = peerUsdcAmount(amount);
  if (!Number.isFinite(n)) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(2);
}

// ─── skeleton rows ────────────────────────────────────────────────────────────

// Shared 4-column grid for header + rows. The OrderbookPanel intentionally has
// four logical columns (Price · Spread · Available · Platform); it does NOT use
// the shared `.book .bh/.br` grid CSS (which is 5-column) to avoid a silent
// override — this inline template is the single source of truth.
const BOOK_GRID: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "2fr 1fr 1fr 1fr",
  gap: 10,
  alignItems: "center",
  padding: "11px 16px",
};

function SkeletonRows() {
  return (
    <>
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          style={{
            ...BOOK_GRID,
            borderBottom: "1px solid var(--line)",
          }}
        >
          <div
            style={{
              height: 14,
              width: 80,
              borderRadius: 6,
              background: "var(--bg-tint)",
              animation: "pulse 1.4s ease-in-out infinite",
            }}
          />
          <div
            style={{
              height: 14,
              width: 54,
              borderRadius: 6,
              background: "var(--bg-tint)",
              marginLeft: "auto",
              animation: "pulse 1.4s ease-in-out infinite",
            }}
          />
          <div
            style={{
              height: 14,
              width: 64,
              borderRadius: 6,
              background: "var(--bg-tint)",
              marginLeft: "auto",
              animation: "pulse 1.4s ease-in-out infinite",
            }}
          />
          <div
            style={{
              height: 14,
              width: 48,
              borderRadius: 6,
              background: "var(--bg-tint)",
              marginLeft: "auto",
              animation: "pulse 1.4s ease-in-out infinite",
            }}
          />
        </div>
      ))}
    </>
  );
}

const filterLabel = (text: string) => (
  <div
    style={{
      fontFamily: "var(--f-tech)",
      fontSize: 10,
      letterSpacing: ".14em",
      textTransform: "uppercase" as const,
      color: "var(--muted-2)",
      marginBottom: 8,
    }}
  >
    {text}
  </div>
);

// ─── main component ───────────────────────────────────────────────────────────

export function OrderbookPanel() {
  const [currency, setCurrency] = React.useState("USD");
  const [platformFilter, setPlatformFilter] = React.useState<string>("all");

  const ob = usePeerOrderbook(currency, platformFilter === "all" ? undefined : platformFilter);

  const allEntries = ob.data?.entries ?? [];
  const [showAll, setShowAll] = React.useState(false);
  const CAP = 12;
  const entries = showAll ? allEntries : allEntries.slice(0, CAP);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Currency filter */}
      <div>
        {filterLabel("Currency")}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {PEER_FIAT_CURRENCIES.map((f) => (
            <button
              key={f.code}
              type="button"
              onClick={() => setCurrency(f.code)}
              className={cn("rtab", currency === f.code && "on")}
              style={{ padding: "6px 12px", fontSize: 12 }}
            >
              <span style={{ marginRight: 4 }}>{f.flag}</span>
              {f.code}
            </button>
          ))}
        </div>
      </div>

      {/* Platform filter */}
      <div>
        {filterLabel("Platform")}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <button
            type="button"
            onClick={() => setPlatformFilter("all")}
            className={cn("rtab", platformFilter === "all" && "on")}
            style={{ padding: "6px 12px", fontSize: 12 }}
          >
            All
          </button>
          {PEER_PAYMENT_PLATFORMS.filter((p) => p.currencies.includes(currency)).map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPlatformFilter(p.key)}
              className={cn("rtab", platformFilter === p.key && "on")}
              style={{ padding: "6px 12px", fontSize: 12 }}
            >
              {p.displayName}
            </button>
          ))}
        </div>
      </div>

      {/* Table — self-contained chrome + 4-column grid (no shared .book grid CSS) */}
      <div
        style={{
          background: "#fff",
          border: "1px solid var(--line)",
          borderRadius: 13,
          boxShadow: "var(--sh-2)",
          overflow: "hidden",
        }}
      >
        {/* header */}
        <div
          style={{
            ...BOOK_GRID,
            background: "var(--bg-soft)",
            borderBottom: "1px solid var(--line)",
            fontFamily: "var(--f-tech)",
            fontSize: 10.5,
            letterSpacing: ".1em",
            textTransform: "uppercase",
            color: "var(--muted-2)",
          }}
        >
          <span>Price ({currency}/USDC)</span>
          <span style={{ textAlign: "right" }}>Spread</span>
          <span style={{ textAlign: "right" }}>Available</span>
          <span style={{ textAlign: "right" }}>Platform</span>
        </div>

        {ob.isLoading ? (
          <SkeletonRows />
        ) : ob.isError ? (
          <div
            style={{
              padding: "32px 18px",
              textAlign: "center",
              fontSize: 13,
              color: "var(--no)",
            }}
          >
            Failed to load the book. Retry shortly.
          </div>
        ) : entries.length === 0 ? (
          <div
            style={{
              padding: "32px 18px",
              textAlign: "center",
              fontSize: 13,
              color: "var(--muted)",
            }}
          >
            No offers for {currency}
            {platformFilter !== "all" ? ` · ${platformFilter}` : ""} right now.
          </div>
        ) : (
          entries.map((entry, idx) => {
            const spread = spreadVsOne(entry.price);
            const usdcAvail = fmtUsdc(entry.availableTokenAmount);
            const isLast = idx === entries.length - 1;

            return (
              <div
                key={`${entry.depositId}-${entry.paymentPlatform}`}
                style={{
                  ...BOOK_GRID,
                  borderBottom: isLast ? "none" : "1px solid var(--line)",
                  cursor: "default",
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
                  {(peerPrice(entry.price) ?? 0).toFixed(4)}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    textAlign: "right",
                    color: spread.positive ? "var(--yes)" : "var(--no)",
                  }}
                >
                  {spread.pct}
                </span>
                <span style={{ fontSize: 12, textAlign: "right", color: "var(--ink-2)" }}>
                  {usdcAvail}
                </span>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <span
                    style={{
                      fontFamily: "var(--f-tech)",
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: ".06em",
                      textTransform: "uppercase",
                      color: "var(--brand)",
                      background: "var(--bg-tint)",
                      border: "1px solid var(--line)",
                      borderRadius: 999,
                      padding: "2px 8px",
                    }}
                  >
                    {entry.paymentPlatform}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      <p style={{ fontSize: 11, color: "var(--muted-2)", margin: 0, lineHeight: 1.5 }}>
        {allEntries.length > CAP && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            style={{
              width: "100%",
              padding: "9px 0",
              margin: "4px 0 10px",
              fontFamily: "var(--f-tech)",
              fontSize: 12,
              fontWeight: 700,
              color: "var(--brand)",
              background: "var(--bg-soft)",
              border: "1px solid var(--line)",
              borderRadius: "var(--r)",
              cursor: "pointer",
            }}
          >
            {showAll ? "Show top 12" : `Show all ${allEntries.length} makers`}
          </button>
        )}
        {allEntries.length} offer{allEntries.length !== 1 ? "s" : ""} · price = {currency} per USDC
        · refreshes every 45s
      </p>
    </div>
  );
}
