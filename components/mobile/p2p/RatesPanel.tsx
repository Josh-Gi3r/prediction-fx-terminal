"use client";

/**
 * components/mobile/p2p/RatesPanel.tsx
 * Mobile orderbook — Rates tab.
 */

import { peerPrice, peerUsdcAmount, usePeerOrderbook } from "@/lib/peer/quotes";
import { useState } from "react";
import { card, flag } from "./shared";

export function MobileRatesPanel() {
  const [currency, setCurrency] = useState("USD");
  const ob = usePeerOrderbook(currency);
  const allEntries = ob.data?.entries ?? [];
  const entries = allEntries.slice(0, 15);

  const MAIN_CURRENCIES = ["USD", "EUR", "GBP", "SGD", "AUD"];

  return (
    <div style={{ margin: "0 0 16px" }}>
      {/* Currency chips */}
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", margin: "0 18px 14px" }}>
        {MAIN_CURRENCIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCurrency(c)}
            style={{
              padding: "5px 11px",
              borderRadius: 8,
              border: currency === c ? "1.5px solid var(--brand)" : "1.5px solid var(--line)",
              background: currency === c ? "var(--bg-tint)" : "#fff",
              color: currency === c ? "var(--brand)" : "var(--muted)",
              fontFamily: "var(--f-tech)",
              fontSize: 11,
              fontWeight: currency === c ? 700 : 500,
              cursor: "pointer",
            }}
          >
            <span style={{ marginRight: 4 }}>{flag(c)}</span>
            {c}
          </button>
        ))}
      </div>

      {/* Book table */}
      <div
        style={{
          ...card,
          margin: "0 18px",
          overflow: "hidden",
        }}
      >
        {/* header */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "96px 60px 1fr 1fr",
            gap: 8,
            padding: "9px 14px",
            background: "var(--bg-soft)",
            borderBottom: "1px solid var(--line)",
            fontFamily: "var(--f-tech)",
            fontSize: 9.5,
            letterSpacing: ".08em",
            textTransform: "uppercase" as const,
            color: "var(--muted-2)",
          }}
        >
          <span>Price ({currency})</span>
          <span style={{ textAlign: "right" }}>Spread</span>
          <span style={{ textAlign: "right" }}>Avail.</span>
          <span style={{ textAlign: "right" }}>Platform</span>
        </div>

        {ob.isLoading ? (
          <div
            style={{
              padding: "20px 14px",
              textAlign: "center",
              color: "var(--muted-2)",
              fontSize: 12,
            }}
          >
            Loading offers…
          </div>
        ) : entries.length === 0 ? (
          <div
            style={{
              padding: "20px 14px",
              textAlign: "center",
              color: "var(--muted-2)",
              fontSize: 12,
            }}
          >
            No offers for {currency} right now
          </div>
        ) : (
          entries.map((entry, idx) => {
            const p = peerPrice(entry.price);
            const avail = peerUsdcAmount(entry.availableTokenAmount);
            const isLast = idx === entries.length - 1;
            const diff = p != null ? (p - 1) * 100 : null;
            const spreadStr = diff != null ? `${diff >= 0 ? "+" : ""}${diff.toFixed(2)}%` : "—";
            return (
              <div
                key={`${entry.depositId}-${entry.paymentPlatform}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "96px 60px 1fr 1fr",
                  gap: 8,
                  padding: "10px 14px",
                  borderBottom: isLast ? "none" : "1px solid var(--line)",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--f-tech)",
                    fontSize: 13,
                    fontWeight: 700,
                    color: "var(--yes)",
                  }}
                >
                  {p != null ? p.toFixed(4) : "—"}
                </span>
                <span
                  style={{
                    fontFamily: "var(--f-tech)",
                    fontSize: 11,
                    fontWeight: 700,
                    textAlign: "right",
                    color: diff != null && diff >= 0 ? "var(--yes)" : "var(--no)",
                  }}
                >
                  {spreadStr}
                </span>
                <span
                  style={{
                    fontFamily: "var(--f-tech)",
                    fontSize: 11,
                    textAlign: "right",
                    color: "var(--ink-2)",
                  }}
                >
                  {avail >= 1000 ? `${(avail / 1000).toFixed(1)}K` : avail.toFixed(0)}
                </span>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <span
                    style={{
                      fontFamily: "var(--f-tech)",
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: ".06em",
                      textTransform: "uppercase" as const,
                      color: "var(--brand)",
                      background: "var(--bg-tint)",
                      border: "1px solid var(--line)",
                      borderRadius: 999,
                      padding: "2px 7px",
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

      <div style={{ margin: "8px 18px 0", fontSize: 11, color: "var(--muted-2)", lineHeight: 1.5 }}>
        {allEntries.length} offer{allEntries.length !== 1 ? "s" : ""} · {currency} per USDC ·
        refreshes every 45s
      </div>
    </div>
  );
}
