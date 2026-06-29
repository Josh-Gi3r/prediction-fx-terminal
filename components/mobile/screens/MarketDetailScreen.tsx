"use client";

/**
 * Specials market detail (dark) — individual novelty / player / tournament
 * market. Wired to the SAME live engine the desktop uses:
 *   · the market object is a live WcLiveMarket (useWcMarkets, liquidity-gated)
 *   · the order book is the live prediction market book via useWcBook
 *   · the player/team visual resolves to a real PHOTO (resolvePlayerVisual)
 *
 * Markup mirrors design-v2 app-screens-wc2 MarketDetailScreen; de-branded
 * (settles "onchain", resolver = "Oracle Council").
 */

import { resolvePlayerVisual } from "@/lib/wc2026/playerVisual";
import { type WcLiveMarket, fmtVolume, useWcBook } from "@/lib/wc2026/usePm";
import { useMemo } from "react";
import type { SlipMarket } from "../BetSlip";
import { Icon } from "../Icon";
import { Disclaimer } from "../primitives";

export type SpecialMarket = WcLiveMarket;

const PLAYER_CATS = new Set([
  "golden_boot",
  "golden_ball",
  "golden_glove",
  "assists",
  "goal_contrib",
  "clean_sheets",
]);

const FLAG_ISO: Record<string, string> = {
  Mexico: "mx",
  "South Africa": "za",
  Canada: "ca",
  "Bosnia-Herz.": "ba",
  "United States": "us",
  USA: "us",
  Paraguay: "py",
  "South Korea": "kr",
  Czechia: "cz",
  Qatar: "qa",
  Switzerland: "ch",
  Brazil: "br",
  Morocco: "ma",
  France: "fr",
  Norway: "no",
  Spain: "es",
  Uruguay: "uy",
  Haiti: "ht",
  Scotland: "gb-sct",
  Australia: "au",
  Turkey: "tr",
  Germany: "de",
  Curaçao: "cw",
  England: "gb-eng",
  Panama: "pa",
  Argentina: "ar",
  Iraq: "iq",
  Portugal: "pt",
  Colombia: "co",
  Netherlands: "nl",
  Japan: "jp",
};

function flagUrl(name: string | null | undefined, w = 80): string | null {
  if (!name) return null;
  const iso = FLAG_ISO[name];
  return iso ? `https://flagcdn.com/w${w}/${iso}.png` : null;
}

/** Resolve the hero visual: real photo for players, flag for nations. */
function heroVisual(p: SpecialMarket): { photo?: string; flag?: string; emoji?: string } {
  const label = p.outcomeLabel ?? "";
  if (PLAYER_CATS.has(p.category) && label) {
    const pv = resolvePlayerVisual(label, p.icon);
    if (pv.type === "photo" && pv.value) return { photo: pv.value };
    if (pv.type === "flag" && pv.value) return { emoji: pv.value };
    if (pv.team) {
      const u = flagUrl(pv.team);
      if (u) return { flag: u };
    }
  }
  const nation = p.teamName ?? label;
  const u = flagUrl(nation);
  if (u) return { flag: u };
  return {};
}

function bucketLabel(category: string): string {
  if (PLAYER_CATS.has(category)) return "Player";
  if (["top_scorer_nation", "continent"].includes(category)) return "Team";
  if (["advance_ko", "reach_round"].includes(category)) return "Tournament";
  return "Special";
}

interface MarketDetailScreenProps {
  p: SpecialMarket;
  onBack: () => void;
  openSlip: (m: SlipMarket) => void;
  openMarket: (p: SpecialMarket) => void;
}

export function MarketDetailScreen({ p, onBack, openSlip }: MarketDetailScreenProps) {
  const yes = p.yesPrice != null ? Math.round(p.yesPrice * 100) : 50;
  const no = 100 - yes;
  const title = p.outcomeLabel || p.question;
  const visual = useMemo(() => heroVisual(p), [p]);

  const { data: bookData } = useWcBook(p.key);
  const bids = (bookData?.bids ?? []).slice(0, 4);
  const asks = (bookData?.asks ?? []).slice(0, 4);

  // Pass live: p so the BetSlip executes a real order from this detail screen.
  const slip = (pick?: "no"): SlipMarket => ({
    q: p.question,
    tag: `${bucketLabel(p.category)} · Special`,
    yesL: "YES",
    noL: "NO",
    yes,
    no,
    live: p,
    ...(pick ? { pick } : {}),
  });

  return (
    <div className="screen dark fade-in">
      <div className="appbar dark">
        <button type="button" className="iconbtn dark" onClick={onBack} aria-label="Back">
          <Icon name="back" size={20} color="#fff" />
        </button>
        <span className="badge-live">
          <span className="dot-live" />
          LIVE
        </span>
        <span className="grow" />
      </div>

      <div style={{ padding: "6px 18px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
          {visual.photo && (
            <img
              src={visual.photo}
              alt=""
              style={{
                width: 38,
                height: 38,
                borderRadius: "50%",
                objectFit: "cover",
                boxShadow: "0 0 0 1px rgba(255,255,255,.18)",
              }}
            />
          )}
          {visual.flag && (
            <img
              src={visual.flag}
              alt=""
              style={{
                width: 34,
                height: 23,
                borderRadius: 4,
                objectFit: "cover",
                boxShadow: "0 0 0 1px rgba(255,255,255,.18)",
              }}
            />
          )}
          {visual.emoji && <span style={{ fontSize: 30, lineHeight: 1 }}>{visual.emoji}</span>}
          <span
            style={{
              fontFamily: "var(--f-tech)",
              fontWeight: 700,
              fontSize: 10,
              letterSpacing: ".1em",
              textTransform: "uppercase",
              color: "#9fb0d8",
              background: "rgba(255,255,255,.07)",
              border: "1px solid rgba(255,255,255,.1)",
              borderRadius: 6,
              padding: "4px 8px",
            }}
          >
            {bucketLabel(p.category)} · Special
          </span>
        </div>
        <h1
          style={{
            fontFamily: "var(--f-display)",
            fontWeight: 800,
            fontSize: 24,
            lineHeight: 1.15,
            letterSpacing: "-.01em",
            color: "#fff",
            margin: "0 0 10px",
          }}
        >
          {title}
        </h1>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 14 }}>
          <span
            style={{
              fontFamily: "var(--f-display)",
              fontWeight: 800,
              fontSize: 38,
              color: "#fff",
              lineHeight: 1,
            }}
          >
            {yes}%
          </span>
          <span
            style={{
              fontFamily: "var(--f-tech)",
              fontSize: 12,
              color: "#8595bd",
              fontWeight: 700,
            }}
          >
            implied chance
          </span>
        </div>
      </div>

      {/* stat strip */}
      <div className="hscroll" style={{ marginTop: 2 }}>
        {(
          [
            [fmtVolume(p.volume), "Volume"],
            [fmtVolume(p.liquidity), "Liquidity"],
            ["Onchain", "Settles"],
            [`${(p.tickSize * 100).toFixed(0)}¢`, "Tick"],
          ] as const
        ).map(([v, l]) => (
          <div
            key={l}
            style={{
              flex: "0 0 auto",
              minWidth: 92,
              background: "rgba(255,255,255,.05)",
              border: "1px solid rgba(255,255,255,.12)",
              borderRadius: 14,
              padding: "11px 14px",
            }}
          >
            <div
              style={{
                fontFamily: "var(--f-display)",
                fontWeight: 800,
                fontSize: 15,
                color: "#fff",
                whiteSpace: "nowrap",
              }}
            >
              {v}
            </div>
            <div
              style={{
                fontFamily: "var(--f-tech)",
                fontSize: 9.5,
                letterSpacing: ".06em",
                textTransform: "uppercase",
                color: "#8595bd",
                marginTop: 2,
                whiteSpace: "nowrap",
              }}
            >
              {l}
            </div>
          </div>
        ))}
      </div>

      {/* buy buttons */}
      <div style={{ margin: "16px 18px 0" }}>
        <div className="yn">
          <button
            type="button"
            className="yes"
            style={{ padding: "15px 8px", fontSize: 15, whiteSpace: "nowrap" }}
            onClick={() => openSlip(slip())}
          >
            Buy YES<small>{yes}¢</small>
          </button>
          <button
            type="button"
            className="no"
            style={{ padding: "15px 8px", fontSize: 15, whiteSpace: "nowrap" }}
            onClick={() => openSlip(slip("no"))}
          >
            Buy NO<small>{no}¢</small>
          </button>
        </div>
      </div>

      {/* live order book */}
      <div className="sec-head ondark">
        <h2>Order book</h2>
        <span style={{ fontFamily: "var(--f-tech)", fontSize: 11, color: "#8595bd" }}>
          YES contract · live
        </span>
      </div>
      <div
        style={{
          margin: "0 18px",
          background: "rgba(255,255,255,.04)",
          border: "1px solid rgba(255,255,255,.1)",
          borderRadius: 16,
          padding: "12px 14px",
        }}
      >
        {bids.length === 0 && asks.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              fontFamily: "var(--f-tech)",
              fontSize: 11.5,
              color: "#7889b3",
              padding: "10px 0",
            }}
          >
            Loading live book…
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
            {(
              [
                ["Bid", bids],
                ["Ask", asks],
              ] as const
            ).map(([h, side], c) => (
              <div key={h}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontFamily: "var(--f-tech)",
                    fontSize: 9.5,
                    letterSpacing: ".1em",
                    textTransform: "uppercase",
                    color: "#7889b3",
                    paddingBottom: 6,
                    borderBottom: "1px solid rgba(255,255,255,.1)",
                    marginBottom: 5,
                  }}
                >
                  <span>{h}</span>
                  <span>Size</span>
                </div>
                {side.map((lvl, i) => {
                  const px = Math.round(Number(lvl.price) * 100);
                  const sz = Math.round(Number(lvl.size));
                  return (
                    <div
                      // biome-ignore lint/suspicious/noArrayIndexKey: fixed-depth book level
                      key={i}
                      style={{
                        position: "relative",
                        display: "flex",
                        justifyContent: "space-between",
                        fontFamily: "var(--f-tech)",
                        fontSize: 12,
                        padding: "4px 6px",
                        borderRadius: 5,
                        overflow: "hidden",
                      }}
                    >
                      <span
                        style={{
                          position: "absolute",
                          inset: 0,
                          opacity: 0.14,
                          background: c === 0 ? "var(--yes)" : "var(--no)",
                          width: `${Math.min(100, sz / 10)}%`,
                        }}
                      />
                      <span
                        style={{
                          position: "relative",
                          fontWeight: 700,
                          color: c === 0 ? "#2ee6a8" : "#ff7d9b",
                        }}
                      >
                        {px}¢
                      </span>
                      <span style={{ position: "relative", color: "#cdd8f2" }}>${sz}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* rules */}
      <div className="sec-head ondark">
        <h2>Rules</h2>
        <span style={{ fontFamily: "var(--f-tech)", fontSize: 11, color: "#8595bd" }}>
          Resolution
        </span>
      </div>
      <p style={{ margin: "0 18px", fontSize: 13, lineHeight: 1.6, color: "#9fb0d8" }}>
        {p.question} Resolves YES if the condition is met per the official match result. Binary
        market · one question · settled onchain.
      </p>
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", margin: "10px 18px 0" }}>
        {["Resolver: Oracle Council", "Source: official event data"].map((s) => (
          <span
            key={s}
            style={{
              fontFamily: "var(--f-tech)",
              fontSize: 10.5,
              color: "#9fb0d8",
              background: "rgba(255,255,255,.05)",
              border: "1px solid rgba(255,255,255,.1)",
              borderRadius: 7,
              padding: "5px 9px",
            }}
          >
            {s}
          </span>
        ))}
      </div>

      <Disclaimer dark />
    </div>
  );
}
