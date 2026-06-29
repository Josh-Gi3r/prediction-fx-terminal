"use client";

/**
 * SpecialsGrid — the Specials / novelty-markets surface.
 *
 * Transplanted from design-handoff/project/wc-specials.html.
 * CSS classes (.sp-band, .sp-marquee, .sp-grid, .spc, .byn, .sp-head,
 * .sp-filter) are verbatim from wc-trade.css, scoped inside .ds4 in
 * app/design.css. No new visual language.
 *
 * Visuals: flagcdn.com/w40/<iso>.png via plain <img> (CSP: img-src https:).
 * Player photos: resolvePlayerVisual — photo > flag-emoji fallback.
 */

import { BetSheet } from "@/components/wc/BetSheet";
import { resolvePlayerVisual } from "@/lib/wc2026/playerVisual";
import { type WcLiveMarket, fmtVolume, useWcMarkets, useWcTrades } from "@/lib/wc2026/usePm";
import { useMemo, useState } from "react";

/* ─────────────────────────────────────────────
   ISO-2 map: team/nation name → flagcdn code
   Ported verbatim from wc-data.js ISO object.
───────────────────────────────────────────── */
const ISO2: Record<string, string> = {
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
  Iran: "ir",
  Egypt: "eg",
  Senegal: "sn",
  Belgium: "be",
  Denmark: "dk",
  Sweden: "se",
  Poland: "pl",
  Algeria: "dz",
  Austria: "at",
  Croatia: "hr",
  Ecuador: "ec",
  Ghana: "gh",
  "Ivory Coast": "ci",
  Jordan: "jo",
  "New Zealand": "nz",
  "Saudi Arabia": "sa",
  Tunisia: "tn",
  Uzbekistan: "uz",
  "Cape Verde": "cv",
  "DR Congo": "cd",
};

/** flagcdn.com URL — returns null if no iso2 known. */
function flagUrl(nameOrIso: string | null | undefined): string | null {
  if (!nameOrIso) return null;
  // Already an iso2 code (1–3 chars, lowercase)
  if (/^[a-z]{2}(-[a-z]{2,3})?$/.test(nameOrIso)) {
    return `https://flagcdn.com/w40/${nameOrIso}.png`;
  }
  const iso = ISO2[nameOrIso];
  return iso ? `https://flagcdn.com/w40/${iso}.png` : null;
}

/* ─────────────────────────────────────────────
   Category definitions — map our PM categories
   to the design's filter labels.
───────────────────────────────────────────── */
const SPECIALS_CATEGORIES = new Set([
  "fun",
  "golden_boot",
  "golden_ball",
  "golden_glove",
  "assists",
  "goal_contrib",
  "clean_sheets",
  "top_scorer_nation",
  "advance_ko",
  "reach_round",
  "continent",
]);

type FilterId = "All" | "Players" | "Teams" | "Tournament" | "Wild";

const FILTER_TABS: readonly FilterId[] = ["All", "Players", "Teams", "Tournament", "Wild"];

/** Map PM category → design filter bucket. */
function filterBucket(category: string): FilterId {
  if (
    [
      "golden_boot",
      "golden_ball",
      "golden_glove",
      "assists",
      "goal_contrib",
      "clean_sheets",
    ].includes(category)
  )
    return "Players";
  if (["top_scorer_nation", "continent"].includes(category)) return "Teams";
  if (["advance_ko", "reach_round"].includes(category)) return "Tournament";
  if (category === "fun") return "Wild";
  return "Wild";
}

/** Pick an accent color per bucket (mirrors the wc-data.js color field). */
function accentColor(m: WcLiveMarket): string {
  const b = filterBucket(m.category);
  if (b === "Players") return "#c8102e";
  if (b === "Teams") return "#2563eb";
  if (b === "Tournament") return "#0bb88a";
  return "#7c3aed";
}

/* ─────────────────────────────────────────────
   Visual for a special card (flag image or
   player photo / emoji flag fallback).
───────────────────────────────────────────── */

interface CardVisual {
  /** "img-flag" = flagcdn img; "pm-img" = PM icon img; "emoji" = emoji flag/region glyph; "none" = nothing */
  kind: "img-flag" | "pm-img" | "emoji" | "none";
  src?: string;
  emoji?: string;
}

/**
 * Continent / region markets ("Which continent wins?") have no flag — show a
 * regional globe glyph instead of the generic Polymarket soccer-ball icon.
 */
const CONTINENT_GLYPH: Record<string, string> = {
  africa: "🌍",
  europe: "🌍",
  asia: "🌏",
  oceania: "🌏",
  "north america": "🌎",
  "south america": "🌎",
  "central america": "🌎",
  americas: "🌎",
};

function continentGlyph(label: string | null | undefined): string | null {
  if (!label) return null;
  return CONTINENT_GLYPH[label.trim().toLowerCase()] ?? null;
}

function resolveCardVisual(m: WcLiveMarket): CardVisual {
  // Continent / region markets: regional globe glyph (no flag exists).
  if (m.category === "continent") {
    const glyph = continentGlyph(m.outcomeLabel);
    if (glyph) return { kind: "emoji", emoji: glyph };
  }

  // For player-cat markets: resolve player photo → flag emoji
  const PLAYER_CATS = new Set([
    "golden_boot",
    "golden_ball",
    "golden_glove",
    "assists",
    "goal_contrib",
    "clean_sheets",
  ]);
  if (PLAYER_CATS.has(m.category) && m.outcomeLabel) {
    const pv = resolvePlayerVisual(m.outcomeLabel, m.icon);
    if (pv.type === "photo" && pv.value) return { kind: "pm-img", src: pv.value };
    if (pv.type === "flag" && pv.value) return { kind: "emoji", emoji: pv.value };
    // Try to get a flagcdn img from the player's team
    if (pv.team) {
      const url = flagUrl(pv.team);
      if (url) return { kind: "img-flag", src: url };
    }
  }

  // For nation-based markets: try teamName, teamCode, outcomeLabel
  if (m.teamName) {
    const url = flagUrl(m.teamName);
    if (url) return { kind: "img-flag", src: url };
  }
  if (m.teamCode) {
    const url = flagUrl(m.teamCode.toLowerCase());
    if (url) return { kind: "img-flag", src: url };
  }
  if (m.outcomeLabel) {
    const url = flagUrl(m.outcomeLabel);
    if (url) return { kind: "img-flag", src: url };
    // Try emoji flag from playerVisual
    const pv = resolvePlayerVisual(m.outcomeLabel, m.icon);
    if (pv.type === "flag" && pv.value) return { kind: "emoji", emoji: pv.value };
  }

  // PM icon img as last resort before nothing
  if (m.icon) return { kind: "pm-img", src: m.icon };
  return { kind: "none" };
}

/* ─────────────────────────────────────────────
   Mini sparkline SVG — seeded walk ending at
   yesPrice, matching the design's history()
───────────────────────────────────────────── */

function seeded(seedStr: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

function historyPts(seed: string, endVal: number, n: number, v: number): number[] {
  const rnd = seeded(seed);
  const pts = new Array<number>(n);
  let x = endVal;
  pts[n - 1] = endVal;
  for (let i = n - 2; i >= 0; i--) {
    x += (rnd() - 0.5) * v * 2 + (rnd() < 0.06 ? (rnd() - 0.5) * v * 6 : 0);
    x = Math.max(2, Math.min(98, x));
    pts[i] = x;
  }
  return pts;
}

interface SparkProps {
  seed: string;
  yesPrice: number;
  width: number;
  height: number;
  n?: number;
  v?: number;
  color?: string;
  lw?: number;
}

function Spark({
  seed,
  yesPrice,
  width,
  height,
  n = 42,
  v = 3.2,
  color = "#2563eb",
  lw = 1.8,
}: SparkProps) {
  const pts = useMemo(() => historyPts(seed, yesPrice, n, v), [seed, yesPrice, n, v]);
  if (pts.length < 2) return null;
  const minP = Math.min(...pts);
  const maxP = Math.max(...pts);
  // Floor the visual range (0-100 scale) so a 1-2pt oscillation doesn't
  // stretch into a full-height sawtooth; centre the data in the padded domain.
  const rawRange = maxP - minP;
  const range = Math.max(rawRange, 14);
  const lo = minP - (range - rawRange) / 2;
  const pad = 2;
  const xs = pts.map((_, i) => pad + (i / (pts.length - 1)) * (width - pad * 2));
  const ys = pts.map((p) => height - pad - ((p - lo) / range) * (height - pad * 2));
  const line = xs
    .map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${(ys[i] ?? 0).toFixed(1)}`)
    .join(" ");
  const firstX = xs[0] ?? 0;
  const lastX = xs[xs.length - 1] ?? width;
  const area = `${line} L${lastX.toFixed(1)},${height} L${firstX.toFixed(1)},${height} Z`;
  const gradId = `sg-${seed.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      style={{ display: "block", overflow: "visible" }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`} />
      <path
        d={line}
        stroke={color}
        strokeWidth={lw}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ─────────────────────────────────────────────
   Marquee sparkline — uses real trades if
   available, falls back to seeded history.
───────────────────────────────────────────── */

function MarqueeSpark({ market }: { market: WcLiveMarket }) {
  const { data: tradesData } = useWcTrades(market.key);
  const yesPrice = market.yesPrice != null ? Math.round(market.yesPrice * 100) : 50;

  const tradePts: number[] | null = useMemo(() => {
    const raw = tradesData?.trades;
    if (!Array.isArray(raw) || raw.length < 4) return null;
    type PmTrade = {
      price?: number | string;
      timestamp?: number | string;
      outcome?: string;
      outcomeIndex?: number;
    };
    const sorted = (raw as PmTrade[])
      .filter((t) => t.price != null && t.timestamp != null)
      .map((t) => {
        const p = Number(t.price);
        // Normalize No-trades (~0.06) to the YES probability so the line
        // doesn't sawtooth between the two outcomes.
        const isNo = t.outcome === "No" || t.outcomeIndex === 1;
        return { price: isNo ? 1 - p : p, ts: Number(t.timestamp) };
      })
      .filter((t) => t.price > 0 && t.price < 1)
      .sort((a, b) => a.ts - b.ts);
    if (sorted.length < 4) return null;
    return sorted.map((t) => Math.round(t.price * 100));
  }, [tradesData]);

  const pts = tradePts ?? historyPts(`mq-${market.key}`, yesPrice, 90, 4);

  const w = 320;
  const h = 150;
  const color = "#2563eb";

  if (pts.length < 2) return <div style={{ width: w, height: h }} />;
  const minP = Math.min(...pts);
  const maxP = Math.max(...pts);
  // Floor the visual range (0-100) so a near-flat real-trade series (e.g.
  // 93↔94) doesn't sawtooth; centre within the padded domain.
  const rawRange = maxP - minP;
  const range = Math.max(rawRange, 14);
  const lo = minP - (range - rawRange) / 2;
  const pad = 2;
  const xs = pts.map((_, i) => pad + (i / (pts.length - 1)) * (w - pad * 2));
  const ys = pts.map((p) => h - pad - ((p - lo) / range) * (h - pad * 2));
  const line = xs
    .map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${(ys[i] ?? 0).toFixed(1)}`)
    .join(" ");
  const lastX = xs[xs.length - 1] ?? w;
  const firstX = xs[0] ?? 0;
  const area = `${line} L${lastX.toFixed(1)},${h} L${firstX.toFixed(1)},${h} Z`;

  return (
    <svg
      width="100%"
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      aria-hidden="true"
      preserveAspectRatio="none"
      style={{ display: "block" }}
    >
      <defs>
        <linearGradient id="mq-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#mq-fill)" />
      <path
        d={line}
        stroke={color}
        strokeWidth="2.4"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ─────────────────────────────────────────────
   Single special card — matches .spc in design
───────────────────────────────────────────── */

function SpecialCard({
  market,
  onBet,
}: {
  market: WcLiveMarket;
  onBet: (m: WcLiveMarket, side: "yes" | "no") => void;
}) {
  const yes = market.yesPrice != null ? Math.round(market.yesPrice * 100) : null;
  const no = yes != null ? 100 - yes : null;
  const label = market.outcomeLabel || market.question;
  const visual = useMemo(() => resolveCardVisual(market), [market]);
  const pc = accentColor(market);
  const catLabel = filterBucket(market.category);

  // 24h delta — seeded for determinism until we have real data
  const d24 = useMemo(() => {
    const rng = seeded(`d24-${market.key}`);
    return Math.round((rng() - 0.4) * 22);
  }, [market.key]);

  return (
    <a
      className="spc"
      href={`/wc/m/${market.key}`}
      style={{ "--pc": pc } as React.CSSProperties}
      onClick={(e) => {
        // allow normal navigation; no-op handler keeps TS happy
        void e;
      }}
      aria-label={`Open market: ${market.question}`}
    >
      {/* top: category badge + flag */}
      <div className="top">
        <span className="cat">{catLabel}</span>
        {visual.kind === "img-flag" && (
          <img className="fl" src={visual.src} alt="" aria-hidden="true" />
        )}
        {visual.kind === "pm-img" && (
          <img
            className="fl"
            src={visual.src}
            alt=""
            aria-hidden="true"
            style={{ borderRadius: "50%", width: 22, height: 22 }}
          />
        )}
        {visual.kind === "emoji" && (
          <span className="fl-emoji" aria-hidden="true">
            {visual.emoji}
          </span>
        )}
      </div>

      {/* question */}
      <div className="qq">{label}</div>

      {/* price + sparkline */}
      <div className="mid">
        <span>
          <span className="pnow">
            {yes != null ? `${yes}¢` : "—"}
            <small>YES</small>
          </span>
          {d24 > 0 && <span className="pd up">▲ {d24}</span>}
          {d24 < 0 && <span className="pd down">▼ {Math.abs(d24)}</span>}
          {d24 === 0 && <span className="pd flat">—</span>}
        </span>
        <div style={{ width: 104, height: 34, flexShrink: 0 }}>
          <Spark seed={`sp-${market.key}`} yesPrice={yes ?? 50} width={104} height={34} />
        </div>
      </div>

      {/* footer: vol + ends */}
      <div className="ftr">
        <span>{fmtVolume(market.volume)} vol</span>
        <span>live</span>
      </div>

      {/* YES / NO buttons */}
      <div
        className="yn"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        aria-label="Trade actions"
      >
        <button
          type="button"
          className="y"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onBet(market, "yes");
          }}
          aria-label={`YES on ${market.question}`}
        >
          YES <small>{yes != null ? `${yes}¢` : ""}</small>
        </button>
        <button
          type="button"
          className="n"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onBet(market, "no");
          }}
          aria-label={`NO on ${market.question}`}
        >
          NO <small>{no != null ? `${no}¢` : ""}</small>
        </button>
      </div>
    </a>
  );
}

/* ─────────────────────────────────────────────
   Marquee card — highest-volume special.
   Matches .sp-marquee from wc-specials.html.
───────────────────────────────────────────── */

function MarqueeCard({
  market,
  onBet,
}: {
  market: WcLiveMarket;
  onBet: (m: WcLiveMarket, side: "yes" | "no") => void;
}) {
  const yes = market.yesPrice != null ? Math.round(market.yesPrice * 100) : null;
  const no = yes != null ? 100 - yes : null;
  const pc = accentColor(market);

  const d24 = useMemo(() => {
    const rng = seeded(`d24-${market.key}`);
    return Math.round((rng() - 0.4) * 22);
  }, [market.key]);

  return (
    <div
      className="sp-marquee"
      style={{ "--pc": pc } as React.CSSProperties}
      aria-label="Most traded special"
    >
      {/* Left: text + buttons */}
      <div className="lft">
        <div className="tagline">★ Most traded special</div>
        <h3>{market.question}</h3>
        <div className="strip">
          <span className="pnow">
            {yes != null ? `${yes}¢` : "—"}
            <small>YES</small>
          </span>
          {d24 > 0 && <span className="pd up">▲ {d24} pts · 24h</span>}
          {d24 < 0 && <span className="pd down">▼ {Math.abs(d24)} pts · 24h</span>}
          {d24 === 0 && <span className="pd flat">flat · 24h</span>}
          <span className="pv">{fmtVolume(market.volume)} vol</span>
        </div>
        <div className="actions">
          <button
            type="button"
            className="byn y"
            onClick={(e) => {
              e.preventDefault();
              onBet(market, "yes");
            }}
            aria-label={`Buy YES: ${market.question}`}
          >
            Buy YES {yes != null && <small>{yes}¢</small>}
          </button>
          <button
            type="button"
            className="byn n"
            onClick={(e) => {
              e.preventDefault();
              onBet(market, "no");
            }}
            aria-label={`Buy NO: ${market.question}`}
          >
            Buy NO {no != null && <small>{no}¢</small>}
          </button>
        </div>
      </div>

      {/* Right: big sparkline */}
      <div className="rgt">
        <MarqueeSpark market={market} />
        <div className="axis">
          <span>7d ago</span>
          <span>5d ago</span>
          <span>3d ago</span>
          <span>Today</span>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Main export — SpecialsGrid
───────────────────────────────────────────── */

const SKELETON_KEYS = ["sk-0", "sk-1", "sk-2", "sk-3", "sk-4", "sk-5", "sk-6", "sk-7"] as const;

export function SpecialsGrid() {
  const [activeFilter, setActiveFilter] = useState<FilterId>("All");
  const [sheet, setSheet] = useState<{ market: WcLiveMarket; side: "yes" | "no" } | null>(null);

  const { data, isLoading } = useWcMarkets({ limit: 200 });

  const allSpecials = useMemo(
    () => (data?.markets ?? []).filter((m) => SPECIALS_CATEGORIES.has(m.category)),
    [data],
  );

  // Marquee = highest-volume special
  const marquee = useMemo(
    () => [...allSpecials].sort((a, b) => b.volume - a.volume)[0] ?? null,
    [allSpecials],
  );

  const filtered = useMemo(() => {
    const list =
      activeFilter === "All"
        ? allSpecials
        : allSpecials.filter((m) => filterBucket(m.category) === activeFilter);
    // Cap the grid — 600+ cards is too heavy to render at once and makes the
    // page feel frozen. Top 60 by volume covers every notable special.
    return [...list].sort((a, b) => b.volume - a.volume).slice(0, 60);
  }, [allSpecials, activeFilter]);

  function handleBet(m: WcLiveMarket, side: "yes" | "no") {
    setSheet({ market: m, side });
  }

  return (
    <section className="sp-band" aria-label="Specials markets">
      <div className="wrap">
        {/* Marquee */}
        {isLoading ? (
          <div
            style={{
              height: 200,
              borderRadius: 22,
              border: "1px solid var(--line)",
              background: "#fff",
              marginBottom: 22,
              animation: "pulse 1.8s infinite",
            }}
          />
        ) : marquee ? (
          <MarqueeCard market={marquee} onBet={handleBet} />
        ) : null}

        {/* Section header + filter chips */}
        <div className="sp-head">
          <div>
            <h2>All specials</h2>
            <p className="msub">One question per market · binary YES / NO · settled onchain</p>
          </div>
          <div className="sp-filter" aria-label="Filter by category">
            {FILTER_TABS.map((f) => (
              <button
                key={f}
                type="button"
                className={f === activeFilter ? "on" : ""}
                onClick={() => setActiveFilter(f)}
                aria-pressed={f === activeFilter}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Card grid */}
        {isLoading ? (
          <div className="sp-grid">
            {SKELETON_KEYS.map((k) => (
              <div
                key={k}
                style={{
                  height: 220,
                  borderRadius: 18,
                  border: "1px solid var(--line)",
                  background: "#fff",
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
            No specials in this category right now.
          </div>
        ) : (
          <div className="sp-grid">
            {filtered.map((m) => (
              <SpecialCard key={m.key} market={m} onBet={handleBet} />
            ))}
          </div>
        )}

        {/* Disclaimer */}
        <div className="disc-d">
          <svg width="15" height="15" viewBox="0 0 15 15" aria-hidden="true">
            <circle cx="7.5" cy="7.5" r="6.5" stroke="#7f90b0" strokeWidth="1.2" fill="none" />
            <path
              d="M7.5 6.6v4M7.5 4.6v.1"
              stroke="#7f90b0"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          Prices reflect implied probability. Not financial advice. 18+ only. Play responsibly.
        </div>
      </div>

      {sheet && (
        <BetSheet market={sheet.market} initialSide={sheet.side} onClose={() => setSheet(null)} />
      )}
    </section>
  );
}

/* ─────────────────────────────────────────────
   SpecialsPreview — the home-hub Specials teaser.
   Renders the design's .sp-grid of .spc cards (wc.html #tops), top-N by
   volume, wired to the same SpecialCard + BetSheet as the full page.
───────────────────────────────────────────── */

const PREVIEW_SKELETON_KEYS = ["pv-0", "pv-1", "pv-2", "pv-3", "pv-4", "pv-5"] as const;

export function SpecialsPreview({ limit = 8 }: { limit?: number }) {
  const [sheet, setSheet] = useState<{ market: WcLiveMarket; side: "yes" | "no" } | null>(null);
  // Homepage teaser: pull only the fast "fun" feed (~0.4s) instead of refreshing
  // all 944 markets (~2.2s + hydration → gray boxes). The full /wc/props page
  // loads the complete specials catalogue.
  const { data, isLoading } = useWcMarkets({ category: "fun" });

  const top = useMemo(() => {
    const specials = data?.markets ?? [];
    return [...specials].sort((a, b) => b.volume - a.volume).slice(0, limit);
  }, [data, limit]);

  function handleBet(m: WcLiveMarket, side: "yes" | "no") {
    setSheet({ market: m, side });
  }

  if (!isLoading && top.length === 0) return null;

  return (
    <>
      <div className="sp-grid">
        {isLoading
          ? PREVIEW_SKELETON_KEYS.map((k) => (
              <div
                key={k}
                style={{
                  height: 220,
                  borderRadius: 18,
                  border: "1px solid var(--line)",
                  background: "#fff",
                  animation: "pulse 1.8s infinite",
                }}
              />
            ))
          : top.map((m) => <SpecialCard key={m.key} market={m} onBet={handleBet} />)}
      </div>

      {sheet && (
        <BetSheet market={sheet.market} initialSide={sheet.side} onClose={() => setSheet(null)} />
      )}
    </>
  );
}
