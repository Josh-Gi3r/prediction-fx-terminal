"use client";

import { useAaveReserves } from "@/lib/desks/aaveHooks";
import { usePendleMarkets, usePerpVaults } from "@/lib/desks/hooks";
import { useMemo, useState } from "react";
import { CARD, EarnSection, INNER_CARD } from "./shared";

// ─── AutoYieldPanel ───────────────────────────────────────────────────────────
export function AutoYieldPanel() {
  const { reserves } = useAaveReserves();
  const { data: pendleData } = usePendleMarkets();
  const { data: perpData } = usePerpVaults();
  const [tier, setTier] = useState<"conservative" | "balanced" | "aggressive">("balanced");
  const [budget, setBudget] = useState("10000");

  const aaveBest = reserves.filter((r) => r.apyPct > 0).sort((a, b) => b.apyPct - a.apyPct)[0];
  const pendleBest = pendleData?.markets?.[0];
  const perpBest = perpData?.gmx?.[0];

  const allocations = useMemo(() => {
    const items: Array<{
      name: string;
      apy: number;
      pct: number;
      url?: string;
      sub?: string;
      anchor?: string;
    }> = [];
    if (tier === "conservative") {
      if (aaveBest)
        items.push({
          name: `Aave ${aaveBest.symbol}`,
          apy: aaveBest.apyPct,
          pct: 100,
          sub: "passive lending · withdraw anytime",
          anchor: "earn-aave",
        });
    } else if (tier === "balanced") {
      if (aaveBest)
        items.push({
          name: `Aave ${aaveBest.symbol}`,
          apy: aaveBest.apyPct,
          pct: 60,
          sub: "passive lending",
          anchor: "earn-aave",
        });
      if (pendleBest)
        items.push({
          name: `Pendle ${pendleBest.symbol ?? pendleBest.name}`,
          apy: pendleBest.impliedApyPct,
          pct: 40,
          anchor: "earn-pendle",
          sub: "fixed PT until expiry",
        });
    } else {
      if (aaveBest)
        items.push({
          name: `Aave ${aaveBest.symbol}`,
          apy: aaveBest.apyPct,
          pct: 30,
          sub: "passive lending",
          anchor: "earn-aave",
        });
      if (pendleBest)
        items.push({
          name: `Pendle ${pendleBest.symbol ?? pendleBest.name}`,
          apy: pendleBest.impliedApyPct,
          pct: 35,
          anchor: "earn-pendle",
          sub: "fixed PT",
        });
      if (perpBest)
        items.push({
          name: `GMX GM ${perpBest.name.split(" ")[0]}`,
          apy: perpBest.apyPct,
          pct: 35,
          anchor: "earn-perp",
          sub: "perp LP · be the house",
        });
    }
    return items;
  }, [tier, aaveBest, pendleBest, perpBest]);

  const blended = allocations.reduce<number>((s, x) => s + (x.apy * x.pct) / 100, 0);
  const budgetNum = Number(budget) || 0;

  return (
    <EarnSection
      title="Smart Yield · best blend by risk tier"
      subtitle="Allocates a stablecoin budget across Aave + Pendle PT + GMX using live APY and our SDYS risk score. We only compute the split; you sign each leg yourself."
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: ".85fr 1.15fr",
          gap: 16,
          alignItems: "start",
        }}
        className="sy-grid"
      >
        <div style={{ ...CARD, display: "flex", flexDirection: "column", gap: 13 }}>
          <div>
            <div
              style={{
                fontFamily: "var(--f-tech)",
                fontSize: 10,
                letterSpacing: ".13em",
                textTransform: "uppercase",
                color: "var(--muted-2)",
              }}
            >
              Budget
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 6 }}>
              <span style={{ color: "var(--muted)", fontSize: 14 }}>$</span>
              <input
                inputMode="decimal"
                value={budget}
                onChange={(e) => /^\d*\.?\d*$/.test(e.target.value) && setBudget(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: 0,
                  border: 0,
                  background: "none",
                  textAlign: "right",
                  fontFamily: "var(--f-display)",
                  fontWeight: 800,
                  fontSize: 24,
                  color: "var(--ink)",
                  outline: "none",
                }}
              />
            </div>
          </div>
          <div>
            <div
              style={{
                fontFamily: "var(--f-tech)",
                fontSize: 10,
                letterSpacing: ".13em",
                textTransform: "uppercase",
                color: "var(--muted-2)",
                marginBottom: 7,
              }}
            >
              Risk tier
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {(["conservative", "balanced", "aggressive"] as const).map((t) => (
                <button
                  type="button"
                  key={t}
                  onClick={() => setTier(t)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    border: `1px solid ${tier === t ? "var(--brand)" : "var(--line)"}`,
                    background: tier === t ? "var(--bg-tint)" : "#fff",
                    borderRadius: 11,
                    padding: "10px 13px",
                    cursor: "pointer",
                    transition: ".14s",
                    textAlign: "left",
                  }}
                >
                  <strong style={{ fontSize: 13.5, textTransform: "capitalize" }}>{t}</strong>
                  <span
                    style={{
                      fontFamily: "var(--f-tech)",
                      fontSize: 9.5,
                      letterSpacing: ".06em",
                      textTransform: "uppercase",
                      color: "var(--muted-2)",
                    }}
                  >
                    {t === "conservative"
                      ? "Aave only"
                      : t === "balanced"
                        ? "Aave + Pendle"
                        : "+ Perp LP"}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div style={INNER_CARD}>
            <div
              style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}
            >
              <span
                style={{
                  fontFamily: "var(--f-tech)",
                  fontSize: 10,
                  letterSpacing: ".08em",
                  textTransform: "uppercase",
                  color: "var(--muted-2)",
                }}
              >
                Blended APY
              </span>
              <span
                style={{
                  fontFamily: "var(--f-display)",
                  fontWeight: 800,
                  fontSize: 26,
                  color: "var(--yes)",
                }}
              >
                {blended.toFixed(2)}%
              </span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 11.5,
                color: "var(--muted)",
                marginTop: 5,
              }}
            >
              <span>Expected yearly</span>
              <span style={{ fontFamily: "var(--f-tech)" }}>
                $
                {((budgetNum * blended) / 100).toLocaleString("en-US", {
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {allocations.length === 0 ? (
            <div
              style={{
                border: "1px solid var(--line)",
                borderRadius: 13,
                padding: 12,
                fontSize: 12,
                color: "var(--muted)",
              }}
            >
              Loading live yields…
            </div>
          ) : (
            allocations.map((a) => {
              const allocAmt = (budgetNum * a.pct) / 100;
              const yearly = (allocAmt * a.apy) / 100;
              const cls: React.CSSProperties = {
                display: "grid",
                gridTemplateColumns: "1fr 0.6fr 0.5fr 0.6fr",
                alignItems: "center",
                gap: 12,
                border: "1px solid var(--line)",
                background: "#fff",
                borderRadius: 13,
                padding: "13px 15px",
                boxShadow: "var(--sh-1)",
                transition: ".12s",
                textDecoration: "none",
                color: "inherit",
              };
              const sharedContent = [
                <span key="nm">
                  <span
                    style={{
                      display: "block",
                      fontWeight: 700,
                      fontSize: 13.5,
                      color: "var(--ink)",
                    }}
                  >
                    {a.name}
                  </span>
                  <span
                    style={{
                      display: "block",
                      fontFamily: "var(--f-ui)",
                      fontWeight: 500,
                      fontSize: 10.5,
                      color: "var(--muted-2)",
                      marginTop: 1,
                    }}
                  >
                    {a.sub}
                  </span>
                </span>,
                <span
                  key="apy"
                  style={{
                    fontFamily: "var(--f-tech)",
                    fontWeight: 700,
                    color: "var(--yes)",
                    fontSize: 13.5,
                    textAlign: "right",
                  }}
                >
                  {a.apy.toFixed(2)}%
                </span>,
                <span
                  key="pct"
                  style={{
                    fontFamily: "var(--f-tech)",
                    fontWeight: 800,
                    fontSize: 13.5,
                    textAlign: "right",
                  }}
                >
                  {a.pct}%
                </span>,
                <span
                  key="amt"
                  style={{
                    fontFamily: "var(--f-tech)",
                    fontSize: 11.5,
                    color: "var(--muted)",
                    textAlign: "right",
                  }}
                >
                  ${allocAmt.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                  <span style={{ display: "block", fontSize: 10, color: "var(--muted-2)" }}>
                    +${yearly.toFixed(0)}/yr
                  </span>
                </span>,
              ];
              return a.anchor ? (
                <button
                  key={a.name}
                  type="button"
                  style={{
                    ...cls,
                    cursor: "pointer",
                    textAlign: "inherit",
                    border: "1px solid var(--line)",
                    background: "var(--bg-soft)",
                  }}
                  onClick={() =>
                    document
                      .getElementById(a.anchor as string)
                      ?.scrollIntoView({ behavior: "smooth", block: "start" })
                  }
                  aria-label={`Go to ${a.name}. Deposit in-app.`}
                >
                  {sharedContent}
                </button>
              ) : a.url ? (
                <a key={a.name} href={a.url} target="_blank" rel="noopener noreferrer" style={cls}>
                  {sharedContent}
                </a>
              ) : (
                <div key={a.name} style={cls}>
                  {sharedContent}
                </div>
              );
            })
          )}
        </div>
      </div>
      <style>{"@media(max-width:760px){.sy-grid{grid-template-columns:1fr!important}}"}</style>
    </EarnSection>
  );
}
