"use client";

import type { WcLiveMarket } from "@/lib/wc2026/usePm";
import { fmtVolume } from "@/lib/wc2026/usePm";
import { fmtCents } from "./helpers";

export interface MarketStatsProps {
  market: WcLiveMarket;
  spread: string | null;
}

export function MarketStats({ market, spread }: MarketStatsProps) {
  return (
    <div
      className="card card-soft"
      style={{
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {[
        ["Volume", fmtVolume(market.volume)],
        ["Liquidity", fmtVolume(market.liquidity)],
        ["Best bid", fmtCents(market.bestBid)],
        ["Best ask", fmtCents(market.bestAsk)],
        ["Spread", spread != null ? `${spread}¢` : "—"],
        ["Tick size", `${(market.tickSize * 100).toFixed(0)}¢`],
      ].map(([label, value]) => (
        <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>{label}</span>
          <span
            style={{
              fontFamily: "var(--f-tech)",
              fontSize: 12,
              fontWeight: 700,
              color: "var(--ink)",
            }}
          >
            {value}
          </span>
        </div>
      ))}
    </div>
  );
}
