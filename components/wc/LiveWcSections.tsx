"use client";

import { OutrightTable } from "@/components/wc/OutrightTable";
import { type OutrightOdds, parsePercent } from "@/lib/wc2026";
import { type WcLiveMarket, fmtVolume, useWcMarkets } from "@/lib/wc2026/usePm";
import { useMemo } from "react";

/**
 * Live Polymarket overlay for the WC outright section.
 * Static bookie odds stay as comparison color; the headline is always the
 * live Polymarket implied price. All numbers passed the liquidity gate.
 */
export function LiveOutrightSection({
  teams,
  maxPct,
}: {
  teams: readonly OutrightOdds[];
  maxPct: number;
}) {
  const { data } = useWcMarkets({ category: "champion" });

  const live = useMemo(() => {
    const map: Record<string, WcLiveMarket> = {};
    for (const m of data?.markets ?? []) {
      if (m.teamName) map[m.teamName.toLowerCase()] = m;
    }
    return map;
  }, [data]);

  const totalVolume = (data?.markets ?? []).reduce((s, m) => s + m.volume, 0);
  const liveMaxPct = Math.max(maxPct, ...Object.values(live).map((m) => (m.yesPrice ?? 0) * 100));

  return (
    <section className="ds4 section">
      <div className="wrap">
        <div
          className="between"
          style={{
            marginBottom: 18,
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <h2 style={{ fontSize: "clamp(24px,3vw,34px)" }}>Outright winner · 48 teams</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {totalVolume > 0 ? (
              <span
                className="chip"
                style={{ display: "inline-flex", alignItems: "center", gap: 7 }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: "var(--yes)",
                    animation: "pulse 1.8s infinite",
                    display: "inline-block",
                  }}
                />
                LIVE · {fmtVolume(totalVolume)} traded
              </span>
            ) : (
              <span className="chip chip-soft">Sorted by live implied %</span>
            )}
          </div>
        </div>
        <p
          style={{
            margin: "-4px 0 16px",
            color: "var(--muted)",
            fontSize: 13.5,
            lineHeight: 1.5,
            maxWidth: 760,
          }}
        >
          One market per team. Each row asks{" "}
          <strong style={{ color: "var(--ink)" }}>
            &ldquo;Will this team win the 2026 World Cup?&rdquo;
          </strong>{" "}
          Buy <strong style={{ color: "var(--yes)" }}>YES</strong> if you think they win,{" "}
          <strong style={{ color: "var(--no)" }}>NO</strong> if you don&apos;t. The % is the live
          market-implied chance. Tap a row to open the full market.
        </p>
        <OutrightTable teams={teams} maxPct={liveMaxPct} live={live} />
      </div>
    </section>
  );
}
