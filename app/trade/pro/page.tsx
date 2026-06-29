"use client";

import { LiveTickerTape } from "@/components/shared/LiveTickerTape";
import { Nav } from "@/components/shared/Nav";
import { EntryPanel } from "@/components/trade/pro/EntryPanel";
import { MarketSelector } from "@/components/trade/pro/MarketSelector";
import { OrderBook } from "@/components/trade/pro/OrderBook";
import { ProChart } from "@/components/trade/pro/ProChart";
import { RecentTrades } from "@/components/trade/pro/RecentTrades";
import { CORRIDORS, type Corridor, spreadBps } from "@/lib/corridors/registry";
import { genBook, genRecentTrades } from "@/lib/orderbook/genBook";
import { useMemo, useState } from "react";

export default function ProPage() {
  const [selected, setSelected] = useState<Corridor>(CORRIDORS[0]!);
  const book = useMemo(
    () => genBook(selected.refRate, spreadBps(selected.tier), selected.seed),
    [selected],
  );
  const trades = useMemo(() => genRecentTrades(selected.refRate, selected.seed), [selected]);
  const positive = selected.refChg >= 0;

  return (
    <div className="ds4">
      <Nav />
      <LiveTickerTape />

      <main
        style={{
          maxWidth: 1400,
          margin: "0 auto",
          padding: "16px 20px 48px",
        }}
      >
        {/* ── Header bar ── */}
        <header
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
            marginBottom: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <span className="eyebrow" style={{ fontSize: 11, letterSpacing: "0.18em" }}>
              Trade · Pro
            </span>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 10,
                marginTop: 4,
              }}
            >
              <h1
                style={{
                  fontFamily: "var(--f-display)",
                  fontWeight: 800,
                  fontSize: 22,
                  letterSpacing: "-0.02em",
                  margin: 0,
                  color: "var(--ink)",
                }}
              >
                {selected.sym}
              </h1>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>{selected.name}</span>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 20,
              flexWrap: "wrap",
            }}
          >
            <ProStat
              label="Mark"
              value={selected.refRate.toFixed(selected.refRate >= 100 ? 2 : 4)}
            />
            <ProStat
              label="24h"
              value={`${positive ? "+" : ""}${selected.refChg.toFixed(2)}%`}
              tone={positive ? "green" : "red"}
            />
            <ProStat label="Funding" value={`${(selected.fundingRate * 100).toFixed(4)}% / 8h`} />
            <a
              href="/trade"
              style={{
                fontFamily: "var(--f-tech)",
                fontWeight: 700,
                fontSize: 12,
                color: "var(--brand)",
                textDecoration: "none",
                padding: "6px 12px",
                borderRadius: 9,
                border: "1px solid var(--line)",
                background: "#fff",
                transition: "border-color .15s",
              }}
            >
              ← Visual mode
            </a>
          </div>
        </header>

        {/* ── Main layout ── */}
        <div className="pro-layout">
          <MarketSelector selected={selected} onSelect={setSelected} />
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <ProChart mid={selected.refRate} seed={selected.seed} positive={positive} />
            <RecentTrades trades={trades} />
          </div>
          <OrderBook book={book} />
          <EntryPanel corridor={selected} />
        </div>
      </main>

      <style>{`
        .pro-layout {
          display: grid;
          grid-template-columns: 200px 1fr 280px 300px;
          gap: 12px;
        }
        @media (max-width: 1200px) {
          .pro-layout { grid-template-columns: 180px 1fr 260px; }
          .pro-layout > :last-child { grid-column: 1 / -1; }
        }
        @media (max-width: 860px) {
          .pro-layout { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}

function ProStat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "green" | "red";
}) {
  const color = tone === "green" ? "var(--yes)" : tone === "red" ? "var(--no)" : "var(--ink)";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
      <span
        style={{
          fontFamily: "var(--f-tech)",
          fontSize: 10,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--muted)",
        }}
      >
        {label}
      </span>
      <span className="mono" style={{ fontSize: 13, fontWeight: 600, color }}>
        {value}
      </span>
    </div>
  );
}
