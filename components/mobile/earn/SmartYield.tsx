"use client";

/**
 * components/mobile/earn/SmartYield.tsx
 * Smart Yield allocation calculator — connects to real data feeds.
 */

import { useAaveReserves } from "@/lib/desks/aaveHooks";
import { type PendleMarket, usePendleMarkets, usePerpVaults } from "@/lib/desks/hooks";
import { useState } from "react";

const money = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

export function SmartYield() {
  const [tier, setTier] = useState<"conservative" | "balanced" | "aggressive">("balanced");
  const [amtStr, setAmtStr] = useState("10000");
  const amt = Number.parseFloat((amtStr || "").replace(/,/g, "")) || 0;

  const { reserves: aave } = useAaveReserves();
  const { data: pendle } = usePendleMarkets();
  const { data: perp } = usePerpVaults();
  const aaveUsdc = aave.find((r) => r.symbol === "USDC")?.apyPct ?? null;
  const topPendle = (pendle?.markets ?? []).reduce<PendleMarket | null>(
    (best, mk) => (best == null || mk.impliedApyPct > best.impliedApyPct ? mk : best),
    null,
  );
  const hlp = perp?.hyperliquid?.aprPct ?? null;

  const TIERS: Record<
    string,
    Array<{ name: string; apy: number | null; sub: string; pct: number }>
  > = {
    conservative: [
      { name: "Aave USDC", apy: aaveUsdc, sub: "passive lending · withdraw anytime", pct: 100 },
    ],
    balanced: [
      { name: "Aave USDC", apy: aaveUsdc, sub: "passive lending", pct: 60 },
      {
        name: `Pendle ${topPendle?.symbol ?? "PT"}`,
        apy: topPendle?.impliedApyPct ?? null,
        sub: "fixed PT until expiry",
        pct: 40,
      },
    ],
    aggressive: [
      { name: "Aave USDC", apy: aaveUsdc, sub: "passive lending", pct: 30 },
      {
        name: `Pendle ${topPendle?.symbol ?? "PT"}`,
        apy: topPendle?.impliedApyPct ?? null,
        sub: "fixed PT",
        pct: 35,
      },
      { name: "Hyperliquid HLP", apy: hlp, sub: "perp LP · be the house", pct: 35 },
    ],
  };
  const al = TIERS[tier] ?? [];
  const liveLegs = al.filter((x) => x.apy != null);
  const blended = liveLegs.reduce((s, x) => s + ((x.apy ?? 0) * x.pct) / 100, 0);

  return (
    <div className="emod fade-in">
      <div className="emod-h">
        <h3>Smart Yield · best blend by risk</h3>
        <p>
          Allocates a budget across Aave + Pendle PT + HLP using live APY and our SDYS risk score.
          You sign each leg (use the Lend tab for individual deposits).
        </p>
      </div>
      <div className="efield">
        <div className="eyebrow-sm">Budget</div>
        <div className="ebudget">
          <span className="ccy">$</span>
          <input
            value={amtStr}
            onChange={(e) => setAmtStr(e.target.value.replace(/[^0-9.,]/g, ""))}
            inputMode="decimal"
          />
        </div>
      </div>
      <div className="eyebrow-sm" style={{ margin: "14px 0 9px" }}>
        Risk tier
      </div>
      <div className="tier">
        {(
          [
            ["conservative", "Conservative", "Aave only"],
            ["balanced", "Balanced", "Aave + Pendle"],
            ["aggressive", "Aggressive", "+ Perp LP"],
          ] as const
        ).map(([k, b, s]) => (
          <button
            type="button"
            key={k}
            className={tier === k ? "on" : ""}
            onClick={() => setTier(k)}
          >
            <b>{b}</b>
            <span>{s}</span>
          </button>
        ))}
      </div>
      <div className="esum" style={{ marginTop: 14 }}>
        <div className="r">
          <span className="k">Blended APY</span>
          <span className="v" style={{ color: "var(--yes)", fontSize: 16 }}>
            {blended.toFixed(2)}%
          </span>
        </div>
        <div className="r">
          <span className="k">Expected yearly</span>
          <span className="v mono">{money((amt * blended) / 100)}</span>
        </div>
      </div>
      <div style={{ marginTop: 13 }}>
        {al.map((a) => {
          const amount = (amt * a.pct) / 100;
          const yearly = a.apy != null ? (amount * a.apy) / 100 : 0;
          return (
            <div className="alc" key={a.name}>
              <span className="nm">
                {a.name}
                <small>{a.sub}</small>
              </span>
              <span className="ap">{a.apy != null ? `${a.apy.toFixed(2)}%` : "—"}</span>
              <span className="am">
                {a.pct}% · {money(amount)}
                <small>+{money(yearly)}/yr</small>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
