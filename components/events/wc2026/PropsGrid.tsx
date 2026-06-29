"use client";

import { BetSheet } from "@/components/wc/BetSheet";
import { resolvePlayerVisual } from "@/lib/wc2026/playerVisual";
import { type WcLiveMarket, fmtVolume, useWcMarkets } from "@/lib/wc2026/usePm";
import Link from "next/link";
import { useMemo, useState } from "react";

/* ─────────────────────────────────────────────────────────────
   PROPS GRID
   Replicates a prediction market props card layout using app light design tokens.
   Uses only existing ds4 tokens + classes — no new visual lang.
   ───────────────────────────────────────────────────────────── */

// All categories that belong on the Props page
const PROPS_CATEGORIES = new Set([
  "golden_boot",
  "golden_ball",
  "golden_glove",
  "top_scorer_nation",
  "assists",
  "goal_contrib",
  "clean_sheets",
  "advance_ko",
  "reach_round",
  "continent",
  "fun",
]);

const FILTER_TABS = [
  { id: "all", label: "All Props" },
  { id: "golden_boot", label: "Golden Boot" },
  { id: "golden_ball", label: "Awards" },
  { id: "top_scorer_nation", label: "Nations" },
  { id: "fun", label: "Novelty" },
] as const;

type FilterId = (typeof FILTER_TABS)[number]["id"];

const SKELETON_KEYS = ["sk-0", "sk-1", "sk-2", "sk-3", "sk-4", "sk-5", "sk-6", "sk-7"] as const;

function PropCard({
  market,
  onBet,
}: {
  market: WcLiveMarket;
  onBet: (m: WcLiveMarket, side: "yes" | "no") => void;
}) {
  const yes = market.yesPrice != null ? Math.round(market.yesPrice * 100) : null;
  const no =
    market.noPrice != null ? Math.round(market.noPrice * 100) : yes != null ? 100 - yes : null;

  // outcomeLabel = per-outcome name (e.g. "Kylian Mbappé"); fallback to question
  const PLAYER_PROP_CATS = new Set([
    "golden_boot",
    "golden_ball",
    "golden_glove",
    "assists",
    "goal_contrib",
    "clean_sheets",
  ]);
  const displayTitle = market.outcomeLabel || market.eventTitle || market.question;
  // Player-prop markets share one generic Polymarket ball icon; resolve a
  // per-player visual (photo → national flag → that ball) instead.
  const pv =
    PLAYER_PROP_CATS.has(market.category) && market.outcomeLabel
      ? resolvePlayerVisual(market.outcomeLabel, market.icon)
      : null;
  const subTitle = market.outcomeLabel ? market.question : null;

  return (
    <Link
      href={`/wc/m/${market.key}`}
      style={{ textDecoration: "none", display: "block" }}
      aria-label={`Open market: ${market.question}`}
    >
      <div
        className="card card-pad"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          height: "100%",
          cursor: "pointer",
          transition: "box-shadow .15s, transform .15s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.boxShadow = "var(--sh-3)";
          (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.boxShadow = "";
          (e.currentTarget as HTMLDivElement).style.transform = "";
        }}
      >
        {/* Header: icon + title */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          {pv?.type === "flag" ? (
            <div
              aria-hidden="true"
              style={{
                width: 32,
                height: 32,
                borderRadius: 6,
                background: "var(--bg-tint)",
                border: "1px solid var(--line)",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 19,
                lineHeight: 1,
              }}
            >
              {pv.value}
            </div>
          ) : (pv?.type === "photo" ? pv.value : market.icon) ? (
            <img
              src={(pv?.type === "photo" ? pv.value : market.icon) ?? ""}
              alt=""
              aria-hidden="true"
              style={{
                width: 32,
                height: 32,
                borderRadius: 6,
                objectFit: "cover",
                flexShrink: 0,
                border: "1px solid var(--line)",
              }}
            />
          ) : (
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 6,
                background: "var(--bg-tint)",
                border: "1px solid var(--line)",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
              }}
              aria-hidden="true"
            >
              ⚽
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                margin: 0,
                fontSize: 13.5,
                fontWeight: 700,
                lineHeight: 1.35,
                color: "var(--ink)",
                overflow: "hidden",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
              }}
            >
              {displayTitle}
            </p>
            {subTitle && (
              <p
                style={{
                  margin: "2px 0 0",
                  fontSize: 11,
                  color: "var(--muted)",
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                  textOverflow: "ellipsis",
                }}
              >
                {subTitle}
              </p>
            )}
          </div>
        </div>

        {/* YES price headline + volume */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              fontFamily: "var(--f-tech)",
              fontWeight: 700,
              fontSize: 24,
              color: "var(--yes)",
              lineHeight: 1,
            }}
          >
            {yes != null ? `${yes}¢` : "—"}
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: "var(--muted-2)",
                marginLeft: 5,
                verticalAlign: "middle",
              }}
            >
              YES
            </span>
          </div>
          <span
            style={{
              fontFamily: "var(--f-tech)",
              fontSize: 11,
              color: "var(--muted)",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            {market.live && (
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "var(--yes)",
                  animation: "pulse 1.8s infinite",
                  display: "inline-block",
                }}
              />
            )}
            {fmtVolume(market.volume)}
          </span>
        </div>

        {/* YES / NO buttons — stop propagation so card link doesn't fire */}
        <div className="yn" onClick={(e) => e.preventDefault()} aria-label="Trade actions">
          <button
            type="button"
            className="yes"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onBet(market, "yes");
            }}
            aria-label={`YES on ${market.question}`}
          >
            YES
            {yes != null && <small style={{ fontSize: 10 }}>{yes}¢</small>}
          </button>
          <button
            type="button"
            className="no"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onBet(market, "no");
            }}
            aria-label={`NO on ${market.question}`}
          >
            NO
            {no != null && <small style={{ fontSize: 10 }}>{no}¢</small>}
          </button>
        </div>
      </div>
    </Link>
  );
}

export function PropsGrid() {
  const [activeFilter, setActiveFilter] = useState<FilterId>("all");
  const [search, setSearch] = useState("");
  const [sheet, setSheet] = useState<{ market: WcLiveMarket; side: "yes" | "no" } | null>(null);

  // Single query — limit=200 returns all visible markets, filter client-side.
  // This avoids calling hooks inside a loop (rules of hooks violation).
  const { data, isLoading } = useWcMarkets({ limit: 200 });

  const allProps = useMemo(
    () => (data?.markets ?? []).filter((m) => PROPS_CATEGORIES.has(m.category)),
    [data],
  );

  const filtered = useMemo(() => {
    let list = allProps;

    if (activeFilter !== "all") {
      // "golden_ball" tab covers awards cluster
      if (activeFilter === "golden_ball") {
        list = list.filter((m) =>
          ["golden_ball", "golden_glove", "assists", "goal_contrib", "clean_sheets"].includes(
            m.category,
          ),
        );
      } else if (activeFilter === "top_scorer_nation") {
        list = list.filter((m) => ["top_scorer_nation", "continent"].includes(m.category));
      } else {
        list = list.filter((m) => m.category === activeFilter);
      }
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (m) =>
          m.question.toLowerCase().includes(q) ||
          (m.outcomeLabel ?? "").toLowerCase().includes(q) ||
          (m.eventTitle ?? "").toLowerCase().includes(q),
      );
    }

    return [...list].sort((a, b) => b.volume - a.volume);
  }, [allProps, activeFilter, search]);

  const totalVolume = filtered.reduce((s, m) => s + m.volume, 0);

  return (
    <>
      {/* Section header */}
      <div
        style={{
          marginBottom: 20,
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          alignItems: "baseline",
          justifyContent: "space-between",
        }}
      >
        <div>
          <h2 style={{ fontSize: "clamp(22px,3vw,32px)", margin: "0 0 4px" }}>
            Props &amp; Specials
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
            Player awards, goals, and novelty markets. Live books.
          </p>
        </div>
        <span className="chip" style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
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
          LIVE · {totalVolume > 0 ? fmtVolume(totalVolume) : "live book"}
          {filtered.length > 0 && ` · ${filtered.length} markets`}
        </span>
      </div>

      {/* Search + filter row */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          marginBottom: 24,
          alignItems: "center",
        }}
      >
        {/* Search */}
        <div style={{ position: "relative", flex: "1 1 200px", minWidth: 180, maxWidth: 320 }}>
          <svg
            width="15"
            height="15"
            viewBox="0 0 15 15"
            fill="none"
            aria-hidden="true"
            style={{
              position: "absolute",
              left: 11,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--muted-2)",
            }}
          >
            <path
              d="M6.5 1a5.5 5.5 0 1 0 3.67 9.58l2.63 2.62a.75.75 0 1 0 1.06-1.06L11.23 9.5A5.5 5.5 0 0 0 6.5 1zM2.5 6.5a4 4 0 1 1 8 0 4 4 0 0 1-8 0z"
              fill="currentColor"
            />
          </svg>
          <input
            type="search"
            placeholder="Search markets…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search props markets"
            style={{
              width: "100%",
              paddingLeft: 32,
              paddingRight: 12,
              paddingTop: 9,
              paddingBottom: 9,
              borderRadius: "var(--r-sm)",
              border: "1px solid var(--line-2)",
              background: "#fff",
              fontSize: 13.5,
              color: "var(--ink)",
              fontFamily: "var(--f-ui)",
              outline: "none",
            }}
          />
        </div>

        {/* Category chips */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveFilter(tab.id)}
              style={{
                fontFamily: "var(--f-tech)",
                fontSize: 12,
                fontWeight: 600,
                padding: "7px 14px",
                borderRadius: 999,
                border: `1px solid ${activeFilter === tab.id ? "var(--brand)" : "var(--line-2)"}`,
                background: activeFilter === tab.id ? "var(--bg-tint)" : "#fff",
                color: activeFilter === tab.id ? "var(--brand)" : "var(--muted)",
                cursor: "pointer",
                transition: ".13s",
                letterSpacing: ".02em",
              }}
              aria-pressed={activeFilter === tab.id}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))",
            gap: 16,
          }}
        >
          {SKELETON_KEYS.map((k) => (
            <div
              key={k}
              style={{
                height: 160,
                borderRadius: "var(--r)",
                border: "1px solid var(--line)",
                background: "var(--bg)",
                animation: "pulse 1.8s infinite",
              }}
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "60px 20px",
            color: "var(--muted)",
            fontFamily: "var(--f-tech)",
            fontSize: 14,
          }}
        >
          {search ? `No markets matching "${search}"` : "No markets in this category right now."}
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))",
            gap: 16,
          }}
        >
          {filtered.map((m) => (
            <PropCard key={m.key} market={m} onBet={(mk, side) => setSheet({ market: mk, side })} />
          ))}
        </div>
      )}

      {/* Footer */}
      {!isLoading && filtered.length > 0 && (
        <p className="mono" style={{ fontSize: 11, color: "var(--muted-2)", marginTop: 20 }}>
          Showing {filtered.length} gate-passing live markets. Prices refresh every 30s. Real books
          only. Nothing faked.
        </p>
      )}

      {sheet && (
        <BetSheet market={sheet.market} initialSide={sheet.side} onClose={() => setSheet(null)} />
      )}
    </>
  );
}
