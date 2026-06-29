"use client";

/**
 * PmBetsSection — "My bets" for the portfolio page.
 *
 * Shows the user's open Polymarket prediction market positions fetched via
 * Data API (/api/pm/positions). Requires PM creds to be derived first
 * (uses the address to query).
 *
 * Settlement copy (doc §6): winnings settle on-chain directly to the
 * user's Polygon wallet when a market resolves. This app is never in the
 * payout path.
 */

import { Skeleton } from "@/components/ui/skeleton";
import { useDeriveCreds } from "@/lib/polymarket/useDeriveCreds";
import { usePositions } from "@/lib/polymarket/usePositions";

function fmtUsd(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function PmBetsSection() {
  const { creds, derive, pending: credsPending, error: credsError, ready } = useDeriveCreds();
  const { positions, isLoading } = usePositions(creds);

  if (!ready) return null;

  if (!creds) {
    return (
      <div className="pf-card">
        <div className="ch">
          <div>
            <div className="eyebrow">
              <span className="tick" />
              Prediction market bets
            </div>
            <h3 style={{ marginTop: 4 }}>My bets</h3>
          </div>
        </div>
        <div
          style={{
            background: "var(--bg-soft)",
            borderRadius: "var(--r)",
            border: "1px solid var(--line)",
            padding: "20px 18px",
            textAlign: "center",
          }}
        >
          <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>
            One-time wallet signature to enable your trading account. Free and deterministic; it
            derives the same credentials every time. No funds are moved.
          </p>
          {credsError && (
            <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--no)" }}>{credsError}</p>
          )}
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => derive().catch(() => {})}
            disabled={credsPending}
            style={{ opacity: credsPending ? 0.65 : 1 }}
          >
            {credsPending ? "Signing…" : "Load my bets"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pf-card">
      <div className="ch">
        <div>
          <div className="eyebrow">
            <span className="tick" />
            Prediction market bets
          </div>
          <h3 style={{ marginTop: 4 }}>My bets</h3>
        </div>
        <span className="right">
          winnings settle onchain to your Polygon wallet · This app is not in the payout path
        </span>
      </div>

      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : positions.length === 0 ? (
        <div className="pf-empty">
          No open prediction market positions. Place a bet on the{" "}
          <a href="/wc" style={{ color: "var(--brand)", fontWeight: 700 }}>
            World Cup
          </a>{" "}
          surface.
        </div>
      ) : (
        <div className="ptbl">
          <div className="hd" style={{ gridTemplateColumns: "3fr 80px 1fr 1fr 1fr" }}>
            <div>Market</div>
            <div className="r">Side</div>
            <div className="r">Shares</div>
            <div className="r">Avg price</div>
            <div className="r">Current</div>
          </div>
          {positions.map((p) => {
            const isYes = p.outcome === "YES" || p.outcome === "Yes";
            const resolved = p.resolved;
            return (
              <div
                key={`${p.conditionId}-${p.outcome}`}
                className="rw"
                style={{ gridTemplateColumns: "3fr 80px 1fr 1fr 1fr" }}
              >
                <div className="tk">
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: 13,
                      lineHeight: 1.35,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {p.title}
                  </span>
                  {resolved && (
                    <span
                      style={{
                        fontFamily: "var(--f-tech)",
                        fontSize: 10,
                        color: p.winner === p.outcome ? "var(--yes)" : "var(--no)",
                        textTransform: "uppercase",
                        letterSpacing: ".06em",
                      }}
                    >
                      {p.winner === p.outcome ? "Won" : "Resolved"}
                    </span>
                  )}
                </div>
                <span
                  className="amt"
                  style={{ color: isYes ? "var(--yes)" : "var(--no)", fontWeight: 700 }}
                >
                  {p.outcome}
                </span>
                <span className="amt">{p.size.toFixed(2)}</span>
                <span className="amt">
                  {p.avgPrice != null ? `${(p.avgPrice * 100).toFixed(1)}¢` : "—"}
                </span>
                <span
                  className="amt"
                  style={{
                    color:
                      p.currentPrice != null && p.avgPrice != null
                        ? p.currentPrice > p.avgPrice
                          ? "var(--yes)"
                          : p.currentPrice < p.avgPrice
                            ? "var(--no)"
                            : "var(--ink)"
                        : "var(--muted-2)",
                  }}
                >
                  {p.currentPrice != null ? `${(p.currentPrice * 100).toFixed(1)}¢` : "—"}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <p
        style={{
          margin: "16px 0 0",
          fontSize: 11,
          color: "var(--muted-2)",
          lineHeight: 1.5,
        }}
      >
        Positions are CTF outcome tokens held in your Polygon wallet. When a market resolves,
        winnings settle onchain directly to your address. This app only reads positions. It never
        holds or moves your funds.
      </p>
    </div>
  );
}

// Needed for WebkitBoxOrient inline style typing
import type React from "react";
