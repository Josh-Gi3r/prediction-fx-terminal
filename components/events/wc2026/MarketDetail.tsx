"use client";

/**
 * MarketDetail — full market page surface.
 *
 * Structure (mirrors Polymarket's layout, light-themed):
 *   1. Header: icon + question + live % + 24h change + category badge
 *   2. Price sparkline (SVG, no extra deps — trades history)
 *   3. Order book: Asks stacked above Bids, PRICE / SHARES / TOTAL columns
 *      with depth-bar tint, Last / Spread divider
 *   4. Buy / Sell panel (reuses BetSheet)
 *   5. Rules / Resolution description
 *
 * Design: App light tokens (--ink/--brand/--yes/--no/--bg-soft etc).
 * No new visual language introduced.
 */

import {
  type WcBookLevel,
  type WcLiveMarket,
  useWcBook,
  useWcMarkets,
  useWcTrades,
} from "@/lib/wc2026/usePm";
import { useMemo } from "react";
import {
  BetPanel,
  MarketHeader,
  MarketRules,
  MarketStats,
  OrderBook,
  type PmTrade,
  Sparkline,
  type TradeEntry,
} from "./market-detail";

/* ─── Main component ─── */

interface MarketDetailProps {
  marketKey: string;
}

export function MarketDetail({ marketKey }: MarketDetailProps) {
  const { data: marketsData, isLoading: marketsLoading } = useWcMarkets({ key: marketKey });
  const { data: bookData, isLoading: bookLoading } = useWcBook(marketKey);
  const { data: tradesData } = useWcTrades(marketKey);

  // Find market from the all-markets endpoint
  const market: WcLiveMarket | undefined = useMemo(() => {
    return marketsData?.markets.find((m) => m.key === marketKey);
  }, [marketsData, marketKey]);

  // Derive sparkline points from recent trades
  const sparkTrades: TradeEntry[] = useMemo(() => {
    const raw = tradesData?.trades;
    if (!Array.isArray(raw)) return [];
    return (raw as PmTrade[])
      .filter((t) => t.price != null && t.timestamp != null)
      .map((t) => {
        const raw = Number(t.price);
        // Normalize to the YES probability: a "No" trade prints its own price
        // (~0.06), so without this the line sawtooths between YES (~0.94) and
        // NO (~0.06). Convert No → 1 − price for one consistent YES series.
        const isNo = t.outcome === "No" || t.outcomeIndex === 1;
        return { price: isNo ? 1 - raw : raw, timestamp: Number(t.timestamp) };
      })
      .filter((t) => t.price > 0 && t.price < 1 && !Number.isNaN(t.price));
  }, [tradesData]);

  const bids: WcBookLevel[] = bookData?.bids ?? [];
  const asks: WcBookLevel[] = bookData?.asks ?? [];

  // Derived market stats — computed before early returns so hooks stay unconditional
  const spread =
    market != null && market.bestAsk > 0 && market.bestBid > 0
      ? ((market.bestAsk - market.bestBid) * 100).toFixed(0)
      : null;

  // 24h change — must be before conditional returns (Rules of Hooks)
  const priceChange: number | null = useMemo(() => {
    if (sparkTrades.length < 2) return null;
    const sorted = [...sparkTrades].sort((a, b) => a.timestamp - b.timestamp);
    const now = Date.now() / 1000;
    const ago24h = now - 86400;
    const oldest24h = sorted.find((t) => t.timestamp >= ago24h);
    if (!oldest24h) return null;
    const latest = sorted[sorted.length - 1];
    if (!latest) return null;
    return (latest.price - oldest24h.price) * 100;
  }, [sparkTrades]);

  if (marketsLoading) {
    return (
      <div
        style={{
          maxWidth: 800,
          margin: "0 auto",
          padding: "40px 28px",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              height: i === 1 ? 100 : 200,
              borderRadius: "var(--r)",
              border: "1px solid var(--line)",
              background: "var(--bg)",
              animation: "pulse 1.8s infinite",
            }}
          />
        ))}
      </div>
    );
  }

  if (!market) {
    return (
      <div
        style={{
          maxWidth: 800,
          margin: "0 auto",
          padding: "60px 28px",
          textAlign: "center",
          color: "var(--muted)",
          fontFamily: "var(--f-tech)",
          fontSize: 14,
        }}
      >
        Market not found or below liquidity gate.
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "var(--maxw)", margin: "0 auto", padding: "0 28px 60px" }}>
      {/* ── Header ── */}
      <MarketHeader market={market} priceChange={priceChange} />

      {/* ── Two-column layout (book + sparkline | bet panel) ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr minmax(260px,320px)",
          gap: 24,
          alignItems: "start",
        }}
      >
        {/* Left column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Sparkline */}
          {sparkTrades.length >= 2 && (
            <div
              style={{
                border: "1px solid var(--line)",
                borderRadius: "var(--r)",
                background: "#fff",
                padding: "16px 18px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 10,
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--f-tech)",
                    fontSize: 11,
                    color: "var(--muted-2)",
                    textTransform: "uppercase",
                    letterSpacing: ".1em",
                  }}
                >
                  Price history (recent trades)
                </span>
                <span
                  style={{
                    fontFamily: "var(--f-tech)",
                    fontSize: 11,
                    color: "var(--muted-2)",
                  }}
                >
                  {sparkTrades.length} trades
                </span>
              </div>
              <div style={{ width: "100%", overflow: "hidden" }}>
                <Sparkline trades={sparkTrades} width={600} height={120} />
              </div>
            </div>
          )}

          {/* Order Book */}
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 10,
              }}
            >
              <h2
                style={{
                  fontFamily: "var(--f-display)",
                  fontWeight: 800,
                  fontSize: 18,
                  letterSpacing: "-.02em",
                  margin: 0,
                  color: "var(--ink)",
                }}
              >
                Order Book
              </h2>
              {bookLoading && (
                <span
                  style={{
                    fontFamily: "var(--f-tech)",
                    fontSize: 11,
                    color: "var(--muted-2)",
                  }}
                >
                  Loading…
                </span>
              )}
              {!bookLoading && spread != null && (
                <span
                  style={{
                    fontFamily: "var(--f-tech)",
                    fontSize: 11,
                    color: "var(--muted)",
                  }}
                >
                  Spread: {spread}¢
                </span>
              )}
            </div>

            {!bookLoading && bids.length === 0 && asks.length === 0 ? (
              <div
                style={{
                  border: "1px solid var(--line)",
                  borderRadius: "var(--r)",
                  background: "#fff",
                  padding: "32px 20px",
                  textAlign: "center",
                  color: "var(--muted)",
                  fontFamily: "var(--f-tech)",
                  fontSize: 13,
                }}
              >
                Order book is empty. No resting orders right now.
              </div>
            ) : (
              <OrderBook
                bids={bids}
                asks={asks}
                bestBid={market.bestBid}
                bestAsk={market.bestAsk}
              />
            )}
          </div>
        </div>

        {/* Right column — Bet Panel + Market Stats */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <BetPanel market={market} />
          <MarketStats market={market} spread={spread} />
        </div>
      </div>

      {/* ── Rules / Resolution ── */}
      <MarketRules marketKey={marketKey} question={market.question} />
    </div>
  );
}
