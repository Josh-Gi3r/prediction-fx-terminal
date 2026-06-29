"use client";

import { useWcMarkets } from "@/lib/wc2026/usePm";

export interface MarketRulesProps {
  marketKey: string;
  question: string;
}

export function MarketRules({ marketKey, question: _question }: MarketRulesProps) {
  // Fetch description from the market-description API route
  const { data } = useWcMarkets({ key: marketKey });
  const market = data?.markets.find((m) => m.key === marketKey);

  // We don't have the description in WcLiveMarket — show generic resolution copy
  // (The registry has the full description in PmRegistryMarket but we only have
  //  the live-filtered slice here. A full description API endpoint would be ideal;
  //  for now we surface what we have.)

  return (
    <div
      style={{
        marginTop: 32,
        borderTop: "1px solid var(--line)",
        paddingTop: 28,
      }}
    >
      <h2
        style={{
          fontFamily: "var(--f-display)",
          fontWeight: 800,
          fontSize: 18,
          letterSpacing: "-.02em",
          margin: "0 0 12px",
          color: "var(--ink)",
        }}
      >
        Rules &amp; Resolution
      </h2>
      <div
        style={{
          background: "var(--bg-soft)",
          border: "1px solid var(--line)",
          borderRadius: "var(--r)",
          padding: "16px 18px",
        }}
      >
        <p
          style={{
            margin: "0 0 8px",
            fontSize: 13,
            color: "var(--muted)",
            lineHeight: 1.6,
          }}
        >
          This market resolves on the official World Cup 2026 result. The full resolution rules
          are shown on each market before you trade.
        </p>
        <p
          style={{
            margin: 0,
            fontSize: 12,
            color: "var(--muted-2)",
            lineHeight: 1.5,
          }}
        >
          Prices and settlement are fully onchain. This app never holds funds. Winnings settle
          directly to your wallet at resolution. 18+ only.
        </p>
      </div>
      {market && (
        <p
          style={{
            marginTop: 8,
            fontSize: 11,
            color: "var(--muted-2)",
            fontFamily: "var(--f-tech)",
          }}
        >
          Market key: {marketKey} · Category: {market.category}
        </p>
      )}
    </div>
  );
}
