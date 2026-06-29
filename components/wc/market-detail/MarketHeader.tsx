"use client";

import { resolvePlayerVisual } from "@/lib/wc2026/playerVisual";
import { type WcLiveMarket, fmtVolume } from "@/lib/wc2026/usePm";
import { DETAIL_PLAYER_CATS } from "./helpers";

export interface MarketHeaderProps {
  market: WcLiveMarket;
  priceChange: number | null;
}

export function MarketHeader({ market, priceChange }: MarketHeaderProps) {
  const yes = market.yesPrice != null ? Math.round(market.yesPrice * 100) : null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 16,
        padding: "32px 0 24px",
      }}
    >
      {(() => {
        const pv =
          DETAIL_PLAYER_CATS.has(market.category) && market.outcomeLabel
            ? resolvePlayerVisual(market.outcomeLabel, market.icon)
            : null;
        if (pv?.type === "flag")
          return (
            <div
              aria-hidden="true"
              style={{
                width: 52,
                height: 52,
                borderRadius: 10,
                background: "var(--bg-tint)",
                border: "1px solid var(--line)",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 30,
                lineHeight: 1,
              }}
            >
              {pv.value}
            </div>
          );
        const imgSrc = pv?.type === "photo" ? pv.value : market.icon;
        return imgSrc ? (
          <img
            src={imgSrc}
            alt=""
            aria-hidden="true"
            style={{
              width: 52,
              height: 52,
              borderRadius: 10,
              objectFit: "cover",
              border: "1px solid var(--line)",
              flexShrink: 0,
            }}
          />
        ) : (
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 10,
              background: "var(--bg-tint)",
              border: "1px solid var(--line)",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
            }}
            aria-hidden="true"
          >
            ⚽
          </div>
        );
      })()}

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Category badge */}
        <div style={{ marginBottom: 6 }}>
          <span className="chip chip-soft" style={{ fontSize: 11, padding: "4px 9px" }}>
            {market.category.replace(/_/g, " ")} · live market
          </span>
        </div>

        <h1
          style={{
            fontFamily: "var(--f-display)",
            fontWeight: 800,
            fontSize: "clamp(20px,3vw,30px)",
            lineHeight: 1.15,
            color: "var(--ink)",
            margin: "0 0 10px",
            letterSpacing: "-.02em",
          }}
        >
          {market.question}
        </h1>

        {/* Live % + change */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <span
            style={{
              fontFamily: "var(--f-tech)",
              fontWeight: 700,
              fontSize: 28,
              color: "var(--yes)",
              lineHeight: 1,
            }}
          >
            {yes != null ? `${yes}%` : "—"}
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--muted-2)",
                marginLeft: 6,
                verticalAlign: "middle",
              }}
            >
              chance
            </span>
          </span>

          {priceChange != null && (
            <span
              style={{
                fontFamily: "var(--f-tech)",
                fontSize: 13,
                fontWeight: 700,
                color: priceChange >= 0 ? "var(--yes)" : "var(--no)",
              }}
            >
              {priceChange >= 0 ? "+" : ""}
              {priceChange.toFixed(1)}% 24h
            </span>
          )}

          {market.live && (
            <span
              className="chip"
              style={{ fontSize: 11, padding: "4px 9px", display: "inline-flex", gap: 6 }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "var(--yes)",
                  animation: "pulse 1.8s infinite",
                  display: "inline-block",
                }}
              />
              LIVE
            </span>
          )}

          <span
            style={{
              fontFamily: "var(--f-tech)",
              fontSize: 12,
              color: "var(--muted)",
            }}
          >
            {fmtVolume(market.volume)} vol
          </span>
        </div>
      </div>
    </div>
  );
}
