"use client";

import { BetSheet } from "@/components/wc/BetSheet";
import { FundWalletModal } from "@/components/wc/FundWalletModal";
import type { WcLiveMarket } from "@/lib/wc2026/usePm";
import { useState } from "react";

export interface BetPanelProps {
  market: WcLiveMarket;
}

export function BetPanel({ market }: BetPanelProps) {
  const [sheet, setSheet] = useState<"yes" | "no" | null>(null);
  const [fundOpen, setFundOpen] = useState(false);
  const yes = market.yesPrice != null ? Math.round(market.yesPrice * 100) : null;
  const no =
    market.noPrice != null ? Math.round(market.noPrice * 100) : yes != null ? 100 - yes : null;

  return (
    <>
      <div
        style={{
          border: "1px solid var(--line)",
          borderRadius: "var(--r)",
          background: "#fff",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid var(--line)",
            background: "var(--bg-soft)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span
            style={{
              fontFamily: "var(--f-tech)",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: ".1em",
              textTransform: "uppercase",
              color: "var(--ink)",
            }}
          >
            Trade
          </span>
          <span
            style={{
              fontFamily: "var(--f-tech)",
              fontSize: 11,
              color: "var(--muted-2)",
            }}
          >
            Prediction market · live
          </span>
        </div>

        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Yes / No buttons */}
          <div className="yn">
            <button
              type="button"
              className="yes"
              onClick={() => setSheet("yes")}
              aria-label={`YES: ${market.question}`}
            >
              YES
              {yes != null && <small style={{ fontSize: 11 }}>{yes}¢</small>}
            </button>
            <button
              type="button"
              className="no"
              onClick={() => setSheet("no")}
              aria-label={`NO: ${market.question}`}
            >
              NO
              {no != null && <small style={{ fontSize: 11 }}>{no}¢</small>}
            </button>
          </div>

          {/* Quick-entry chips */}
          <div
            style={{
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
            }}
          >
            {[1, 5, 10, 100].map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => setSheet("yes")}
                style={{
                  fontFamily: "var(--f-tech)",
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "5px 11px",
                  borderRadius: 8,
                  border: "1px solid var(--line-2)",
                  background: "var(--bg-soft)",
                  color: "var(--muted)",
                  cursor: "pointer",
                  transition: ".12s",
                }}
                aria-label={`Quick bet $${amt}`}
              >
                +${amt}
              </button>
            ))}
          </div>

          <p
            style={{
              margin: 0,
              fontSize: 11,
              color: "var(--muted-2)",
              lineHeight: 1.5,
              textAlign: "center",
            }}
          >
            Bets settle onchain, directly to your wallet.{" "}
            <button
              type="button"
              onClick={() => setFundOpen(true)}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                color: "var(--brand)",
                fontSize: "inherit",
                fontFamily: "inherit",
              }}
            >
              Fund with USDC.e
            </button>
          </p>
        </div>
      </div>
      <FundWalletModal open={fundOpen} onClose={() => setFundOpen(false)} />

      {sheet && <BetSheet market={market} initialSide={sheet} onClose={() => setSheet(null)} />}
    </>
  );
}
