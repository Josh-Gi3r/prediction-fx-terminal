"use client";

import { LiveTickerTape } from "@/components/shared/LiveTickerTape";
import { Nav } from "@/components/shared/Nav";
import { PredictFxPopup } from "@/components/shared/PredictFxPopup";
import { CategoryChips } from "@/components/trade/CategoryChips";
import { CorridorCard } from "@/components/trade/CorridorCard";
import { Heatmap } from "@/components/trade/Heatmap";
import { InstrumentTabs } from "@/components/trade/InstrumentTabs";
import { TradeDrawer } from "@/components/trade/TradeDrawer";
import { type CorridorRegion, filterCorridors } from "@/lib/corridors/registry";
import { useState } from "react";

export default function TradePage() {
  const [region, setRegion] = useState<"all" | CorridorRegion>("all");
  const corridors = filterCorridors(region);

  return (
    <div className="ds4">
      <Nav />
      <LiveTickerTape />
      <PredictFxPopup />

      {/* ── Hero — instrument selector lives inside the hero copy, matching the mockup ── */}
      <section className="s-hero" style={{ minHeight: 460 }}>
        <img className="s-hero-bg" src="/brand/heroes/trade.jpg" alt="" aria-hidden="true" />
        <div className="wrap s-hero-inner" style={{ minHeight: 460 }}>
          <div className="s-hero-copy" style={{ maxWidth: 560 }}>
            <span
              className="eyebrow"
              style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}
            >
              <span className="dot-live" style={{ background: "var(--accent-2)" }} />
              Predict FX · {corridors.length} corridors live
              <span
                style={{
                  fontFamily: "var(--f-tech)",
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: ".1em",
                  textTransform: "uppercase",
                  color: "#92400e",
                  background: "rgba(234,179,8,.15)",
                  border: "1px solid rgba(234,179,8,.35)",
                  borderRadius: 999,
                  padding: "2px 8px",
                  whiteSpace: "nowrap",
                }}
              >
                Coming soon
              </span>
            </span>
            <h1 style={{ marginTop: 14, marginBottom: 14 }}>
              Pick a corridor.
              <br />
              Call the move.
              <br />
              <span className="blue">Get paid if you&apos;re right.</span>
            </h1>
            <p className="lead" style={{ marginBottom: 22, maxWidth: 480 }}>
              Trade YES or NO on where a rate settles, or go long and short with leverage. Priced
              live, settled in stablecoins.
            </p>
            {/* Instrument selector — inside the hero, max-width matches mockup */}
            <InstrumentTabs />
          </div>
        </div>
      </section>

      <main className="wrap" style={{ paddingBottom: 80 }}>
        {/* ── Heatmap ── */}
        <section style={{ paddingTop: 46, marginBottom: 6 }}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: 16,
              marginBottom: 18,
              flexWrap: "wrap",
            }}
          >
            <div>
              <h2
                style={{
                  fontFamily: "var(--f-display)",
                  fontWeight: 800,
                  fontSize: "clamp(22px,2.4vw,30px)",
                  letterSpacing: "-.02em",
                  margin: 0,
                }}
              >
                Corridor heat{" "}
                <span className="blue" style={{ fontWeight: 800 }}>
                  · 24h
                </span>
              </h2>
              <p style={{ margin: "5px 0 0", fontSize: 13.5, color: "var(--muted)" }}>
                Implied 24h move across all {corridors.length} live corridors. Tap a tile to jump to
                its market.
              </p>
            </div>
          </div>
          <Heatmap />
        </section>

        {/* ── Filter + grid ── */}
        <section style={{ paddingTop: 34 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 24,
              flexWrap: "wrap",
            }}
          >
            <CategoryChips active={region} onChange={setRegion} />
            <a
              href="/trade/pro"
              style={{
                fontFamily: "var(--f-tech)",
                fontWeight: 700,
                fontSize: 13,
                color: "var(--brand)",
                background: "none",
                border: "none",
                cursor: "pointer",
                textDecoration: "none",
              }}
            >
              Pro mode →
            </a>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 18,
            }}
            className="trade-mgrid"
          >
            {corridors.map((c, idx) => (
              <CorridorCard key={c.sym} corridor={c} index={idx} />
            ))}
          </div>
        </section>
      </main>

      <TradeDrawer />

      <style>{`
        @media (max-width: 1100px) { .trade-mgrid { grid-template-columns: repeat(2,1fr) !important; } }
        @media (max-width: 680px)  { .trade-mgrid { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  );
}
