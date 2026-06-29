"use client";

import { PLAYER_ODDS } from "@/lib/wc2026";
import { resolvePlayerVisual } from "@/lib/wc2026/playerVisual";
import { normalizePmTeamName } from "@/lib/wc2026/teamAlias";
import { type WcLiveMarket, fmtVolume, useWcMarkets } from "@/lib/wc2026/usePm";
import { useMemo, useState } from "react";
import type { SlipMarket } from "../BetSlip";
import { Icon } from "../Icon";
import {
  BRACKET,
  FEATURED,
  GROUPS,
  MATCH_DATES,
  TEAMS,
  WC_MATCHES,
  type WcMatch,
  amImplied,
} from "../data";
import { Disclaimer, FeaturedCard, Flag, MatchCardFull, flagSrc } from "../primitives";
import type { SpecialMarket } from "./MarketDetailScreen";

// ── Live Specials segment (shares desktop engine: useWcMarkets + photos) ────────
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

const PLAYER_CATS = new Set([
  "golden_boot",
  "golden_ball",
  "golden_glove",
  "assists",
  "goal_contrib",
  "clean_sheets",
]);

type SpecialFilter = "All" | "Players" | "Teams" | "Tournament" | "Wild";

function filterBucket(category: string): SpecialFilter {
  if (PLAYER_CATS.has(category)) return "Players";
  if (["top_scorer_nation", "continent"].includes(category)) return "Teams";
  if (["advance_ko", "reach_round"].includes(category)) return "Tournament";
  return "Wild";
}

function accentColor(category: string): string {
  const b = filterBucket(category);
  if (b === "Players") return "#c8102e";
  if (b === "Teams") return "#2563eb";
  if (b === "Tournament") return "#0bb88a";
  return "#7c3aed";
}

const FLAG_ISO: Record<string, string> = {
  Brazil: "br",
  France: "fr",
  Spain: "es",
  England: "gb-eng",
  Argentina: "ar",
  Portugal: "pt",
  Germany: "de",
  Netherlands: "nl",
  Norway: "no",
  Morocco: "ma",
  Mexico: "mx",
  Japan: "jp",
  Colombia: "co",
  Uruguay: "uy",
  USA: "us",
  "South Korea": "kr",
};

function flagUrl(name: string | null | undefined): string | null {
  if (!name) return null;
  const iso = FLAG_ISO[name];
  return iso ? `https://flagcdn.com/w40/${iso}.png` : null;
}

/** Resolve the small card visual: real photo for players, flag for nations. */
function cardVisual(m: WcLiveMarket): { photo?: string; flag?: string; emoji?: string } {
  const label = m.outcomeLabel ?? "";
  if (PLAYER_CATS.has(m.category) && label) {
    const pv = resolvePlayerVisual(label, m.icon);
    if (pv.type === "photo" && pv.value) return { photo: pv.value };
    if (pv.type === "flag" && pv.value) return { emoji: pv.value };
    if (pv.team) {
      const u = flagUrl(pv.team);
      if (u) return { flag: u };
    }
  }
  const u = flagUrl(m.teamName ?? label);
  if (u) return { flag: u };
  // Standalone markets (Ronaldo cry, Neymar to play) carry a real photo on the
  // PM event icon -- use it rather than rendering nothing.
  if (m.icon) return { photo: m.icon };
  return {};
}

function LiveSpecials({
  openMarket,
  openSlip,
}: {
  openMarket: (p: SpecialMarket) => void;
  openSlip: (m: SlipMarket) => void;
}) {
  const [cat, setCat] = useState<SpecialFilter>("All");
  const { data, isLoading } = useWcMarkets({ limit: 200 });

  const all = useMemo(
    () => (data?.markets ?? []).filter((m) => SPECIALS_CATEGORIES.has(m.category)),
    [data],
  );
  const list = useMemo(() => {
    const f = cat === "All" ? all : all.filter((m) => filterBucket(m.category) === cat);
    return [...f].sort((a, b) => b.volume - a.volume).slice(0, 40);
  }, [all, cat]);

  const cats: SpecialFilter[] = ["All", "Players", "Teams", "Tournament", "Wild"];

  return (
    <>
      <div className="chiprow" style={{ marginBottom: 14 }}>
        {cats.map((c) => (
          <button
            type="button"
            key={c}
            className={`chip dark${cat === c ? " on" : ""}`}
            onClick={() => setCat(c)}
          >
            {c}
          </button>
        ))}
      </div>
      <div style={{ margin: "0 18px" }}>
        {isLoading && (
          <div
            style={{
              textAlign: "center",
              fontFamily: "var(--f-tech)",
              fontSize: 13,
              color: "#7889b3",
              padding: "40px 0",
            }}
          >
            Loading live specials...
          </div>
        )}
        {!isLoading && list.length === 0 && (
          <div
            style={{
              textAlign: "center",
              fontFamily: "var(--f-tech)",
              fontSize: 13,
              color: "#7889b3",
              padding: "40px 0",
            }}
          >
            No specials in this category right now.
          </div>
        )}
        {list.map((p) => {
          const yes = p.yesPrice != null ? Math.round(p.yesPrice * 100) : 50;
          const vis = cardVisual(p);
          const pc = accentColor(p.category);
          const label = p.outcomeLabel || p.question;
          // Pass live: p so the BetSlip executes the real order for specials cards.
          const mkSlip = (pick?: "no"): SlipMarket => ({
            q: p.question,
            tag: `Special · ${filterBucket(p.category)}`,
            yesL: "YES",
            noL: "NO",
            yes,
            no: 100 - yes,
            live: p,
            ...(pick ? { pick } : {}),
          });
          return (
            <button
              type="button"
              key={p.key}
              className="spm"
              style={
                {
                  "--pc": pc,
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  position: "relative",
                  overflow: "hidden",
                  background: "linear-gradient(165deg,rgba(255,255,255,.06),rgba(255,255,255,.02))",
                  border: "1px solid rgba(255,255,255,.12)",
                  borderRadius: 18,
                  padding: "13px 14px 14px",
                  marginBottom: 12,
                } as React.CSSProperties
              }
              onClick={() => openMarket(p)}
            >
              <span
                style={{
                  position: "absolute",
                  inset: 0,
                  pointerEvents: "none",
                  opacity: 0.4,
                  background: `radial-gradient(70% 60% at 100% 0%, ${pc}30, transparent 60%)`,
                }}
              />
              <div
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--f-tech)",
                    fontWeight: 700,
                    fontSize: 9.5,
                    letterSpacing: ".1em",
                    textTransform: "uppercase",
                    color: "#9fb0d8",
                    background: "rgba(255,255,255,.07)",
                    border: "1px solid rgba(255,255,255,.1)",
                    borderRadius: 6,
                    padding: "3px 7px",
                  }}
                >
                  {filterBucket(p.category)}
                </span>
                {vis.photo && (
                  <img
                    src={vis.photo}
                    alt=""
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: "50%",
                      objectFit: "cover",
                      boxShadow: "0 0 0 1px rgba(255,255,255,.15)",
                    }}
                  />
                )}
                {vis.flag && (
                  <img
                    src={vis.flag}
                    alt=""
                    style={{
                      width: 24,
                      height: 16,
                      borderRadius: 3,
                      objectFit: "cover",
                      boxShadow: "0 0 0 1px rgba(255,255,255,.15)",
                    }}
                  />
                )}
                {vis.emoji && <span style={{ fontSize: 22, lineHeight: 1 }}>{vis.emoji}</span>}
              </div>
              <div
                style={{
                  position: "relative",
                  fontFamily: "var(--f-display)",
                  fontWeight: 800,
                  fontSize: 15.5,
                  lineHeight: 1.3,
                  color: "#fff",
                  letterSpacing: "-.01em",
                  marginBottom: 8,
                }}
              >
                {label}
              </div>
              <div
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "space-between",
                  gap: 8,
                  marginBottom: 11,
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--f-display)",
                    fontWeight: 800,
                    fontSize: 26,
                    color: "#fff",
                    lineHeight: 1,
                  }}
                >
                  {yes}¢
                  <span style={{ fontSize: 11, color: "#8595bd", fontWeight: 700, marginLeft: 3 }}>
                    YES
                  </span>
                </span>
                <span
                  style={{
                    fontFamily: "var(--f-tech)",
                    fontSize: 10.5,
                    color: "#7889b3",
                    whiteSpace: "nowrap",
                  }}
                >
                  {fmtVolume(p.volume)} vol
                </span>
              </div>
              <span
                className="yn"
                style={{
                  position: "relative",
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                }}
              >
                <button
                  type="button"
                  className="yes"
                  onClick={(e) => {
                    e.stopPropagation();
                    openSlip(mkSlip());
                  }}
                >
                  YES<small>{yes}¢</small>
                </button>
                <button
                  type="button"
                  className="no"
                  onClick={(e) => {
                    e.stopPropagation();
                    openSlip(mkSlip("no"));
                  }}
                >
                  NO<small>{100 - yes}¢</small>
                </button>
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}

// Golden Boot avatar: real player PHOTO when we have one, else national flag.
function BootAvatar({ name }: { name: string }) {
  const pv = resolvePlayerVisual(name, null);
  if (pv.type === "photo" && pv.value) {
    return (
      <img
        src={pv.value}
        alt=""
        style={{
          width: 30,
          height: 30,
          borderRadius: "50%",
          objectFit: "cover",
          flex: "0 0 auto",
          boxShadow: "0 0 0 1px rgba(255,255,255,.15)",
        }}
      />
    );
  }
  if (pv.type === "flag" && pv.value) {
    return (
      <span style={{ fontSize: 20, lineHeight: 1, flex: "0 0 auto" }} aria-hidden="true">
        {pv.value}
      </span>
    );
  }
  return (
    <span style={{ fontSize: 18, lineHeight: 1, flex: "0 0 auto" }} aria-hidden="true">
      ⚽
    </span>
  );
}

/**
 * Live Golden Boot -- same engine as desktop BootClient: rows and prices come
 * from the live golden_boot registry (full player names -> photo manifest hits),
 * static PLAYER_ODDS is club enrichment only. Tapping a row opens the live
 * market detail (real book + bet flow); YES/NO open the BetSlip sheet directly
 * with the live market attached, matching every other segment.
 */
function LiveBoot({
  openMarket,
  openSlip,
}: {
  openMarket: (p: SpecialMarket) => void;
  openSlip: (m: SlipMarket) => void;
}) {
  const { data, isLoading } = useWcMarkets({ category: "golden_boot" });

  const clubLookup = useMemo(() => {
    const map = new Map<string, { club: string; nation: string }>();
    for (const pl of PLAYER_ODDS) {
      const v = { club: pl.club, nation: pl.nation };
      map.set(pl.player.toLowerCase(), v);
      const last = pl.player.split(" ").pop()?.toLowerCase();
      if (last && !map.has(last)) map.set(last, v);
    }
    return map;
  }, []);

  const rows = useMemo(() => {
    return (data?.markets ?? [])
      .filter((m) => m.yesPrice != null)
      .sort((a, b) => (b.yesPrice ?? 0) - (a.yesPrice ?? 0))
      .slice(0, 20)
      .map((m) => {
        const name =
          m.outcomeLabel ||
          m.question.match(/^Will (.+?) (?:be the top goalscorer|win the Golden Boot)/i)?.[1] ||
          m.question;
        const info =
          clubLookup.get(name.toLowerCase()) ??
          clubLookup.get(name.split(" ").pop()?.toLowerCase() ?? "") ??
          null;
        return { m, name, club: info?.club ?? null, nation: info?.nation ?? null };
      });
  }, [data, clubLookup]);

  if (isLoading) {
    return (
      <div
        style={{
          textAlign: "center",
          fontFamily: "var(--f-tech)",
          fontSize: 13,
          color: "#7889b3",
          padding: "40px 0",
        }}
      >
        Loading live Golden Boot...
      </div>
    );
  }

  return (
    <div style={{ margin: "0 18px" }}>
      {rows.map(({ m, name, club, nation }, i) => {
        const yes = Math.round((m.yesPrice ?? 0) * 100);
        // Pass live: m so the BetSlip executes the real Golden Boot order.
        const mkSlip = (pick?: "no"): SlipMarket => ({
          q: m.question,
          tag: "Golden Boot",
          yesL: "YES",
          noL: "NO",
          yes: Math.max(1, yes),
          no: Math.min(99, 100 - yes),
          live: m,
          ...(pick ? { pick } : {}),
        });
        return (
          <div className="bootrow" key={m.key}>
            <span className="rk">{String(i + 1).padStart(2, "0")}</span>
            <button
              type="button"
              className="pl"
              style={{
                background: "none",
                border: "none",
                padding: 0,
                textAlign: "left",
                cursor: "pointer",
              }}
              onClick={() => openMarket(m)}
              aria-label={`Open market: ${m.question}`}
            >
              <BootAvatar name={name} />
              <span style={{ minWidth: 0 }}>
                <div className="nm">{name}</div>
                <div className="tm">{club ?? nation ?? "World Cup 2026"}</div>
              </span>
            </button>
            <span className="gl" style={{ fontFamily: "var(--f-tech)", fontSize: 11 }}>
              {fmtVolume(m.volume)}
            </span>
            <span className="yn" style={{ width: 128 }}>
              <button type="button" className="yes" onClick={() => openSlip(mkSlip())}>
                YES<small>{Math.max(1, yes)}¢</small>
              </button>
              <button type="button" className="no" onClick={() => openSlip(mkSlip("no"))}>
                NO<small>{Math.min(99, 100 - yes)}¢</small>
              </button>
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Live Outright segment: champion category from Polymarket ─────────────────

/**
 * Builds a map of lowercase-team-name -> WcLiveMarket from champion markets.
 * Mirrors the logic in desktop OutrightTable / BracketClient.
 */
function useChampionMap(): { map: Record<string, WcLiveMarket>; isLoading: boolean } {
  const { data, isLoading } = useWcMarkets({ category: "champion" });
  const map = useMemo(() => {
    const out: Record<string, WcLiveMarket> = {};
    for (const m of data?.markets ?? []) {
      // teamName is primary; also try to parse from question text
      const raw = m.teamName ?? m.question.match(/^Will (.+?) win the (2026 )?World Cup/i)?.[1];
      const norm = normalizePmTeamName(raw);
      if (norm) out[norm.toLowerCase()] = m;
    }
    return out;
  }, [data]);
  return { map, isLoading };
}

function LiveOutright({ openSlip }: { openSlip: (m: SlipMarket) => void }) {
  const { map: championMap, isLoading } = useChampionMap();

  if (isLoading) {
    return (
      <div
        style={{
          textAlign: "center",
          fontFamily: "var(--f-tech)",
          fontSize: 13,
          color: "#7889b3",
          padding: "40px 0",
        }}
      >
        Loading live markets...
      </div>
    );
  }

  return (
    <div style={{ margin: "0 18px" }}>
      {TEAMS.map((t, i) => {
        const [name, code, grp, odds, imp] = t;
        const lm = championMap[name.toLowerCase()];
        const liveYes = lm?.yesPrice != null ? Math.max(1, Math.round(lm.yesPrice * 100)) : null;
        // Fall back to seed implied probability if no live market
        const y = liveYes ?? Math.max(1, Math.round(imp));

        return (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: static design-data list
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "24px 1fr auto",
              alignItems: "center",
              gap: 12,
              padding: "11px 0",
              borderBottom: "1px solid rgba(255,255,255,.08)",
            }}
          >
            <span
              style={{
                fontFamily: "var(--f-tech)",
                fontWeight: 700,
                color: "#7889b3",
                fontSize: 12,
              }}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <Flag code={code} size={26} />
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 14.5,
                    color: "#fff",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {name}
                </div>
                <div style={{ fontFamily: "var(--f-tech)", fontSize: 11, color: "#8595bd" }}>
                  Grp {grp} ·{" "}
                  {liveYes != null ? `${liveYes}¢ live` : imp >= 1 ? `${imp}% ref` : "<1% ref"} ·{" "}
                  {odds}
                  {lm && (
                    <span style={{ color: "#34d399", marginLeft: 4 }}>{fmtVolume(lm.volume)}</span>
                  )}
                </div>
              </div>
            </div>
            {lm ? (
              <div className="yn" style={{ width: 128 }}>
                <button
                  type="button"
                  className="yes"
                  onClick={() =>
                    openSlip({
                      q: lm.question,
                      tag: "Outright winner",
                      yesL: "YES",
                      noL: "NO",
                      yes: y,
                      no: 100 - y,
                      live: lm,
                    })
                  }
                >
                  YES<small>{y}¢</small>
                </button>
                <button
                  type="button"
                  className="no"
                  onClick={() =>
                    openSlip({
                      q: lm.question,
                      tag: "Outright winner",
                      yesL: "YES",
                      noL: "NO",
                      yes: y,
                      no: 100 - y,
                      live: lm,
                      pick: "no",
                    })
                  }
                >
                  NO<small>{100 - y}¢</small>
                </button>
              </div>
            ) : (
              <span
                style={{
                  fontFamily: "var(--f-tech)",
                  fontSize: 10,
                  color: "#7889b3",
                  width: 128,
                  textAlign: "center",
                  display: "block",
                }}
              >
                not yet tradeable
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Live Groups segment: group_winner category from Polymarket ───────────────

function useGroupWinnerMap(): {
  byGroup: Map<string, Record<string, WcLiveMarket>>;
  isLoading: boolean;
} {
  const { data, isLoading } = useWcMarkets({ category: "group_winner", limit: 200 });
  const byGroup = useMemo(() => {
    const out = new Map<string, Record<string, WcLiveMarket>>();
    for (const m of data?.markets ?? []) {
      if (!m.groupId) continue;
      if (!out.has(m.groupId)) out.set(m.groupId, {});
      const group = out.get(m.groupId)!;

      if (m.teamName) {
        const norm = normalizePmTeamName(m.teamName);
        if (norm) group[norm.toLowerCase()] = m;
      }

      // Parse from question: "Will X win Group A..."
      const qMatch = m.question.match(/^Will (.+?) win Group/);
      if (qMatch?.[1]) {
        const parsed = normalizePmTeamName(qMatch[1]);
        if (parsed) group[parsed.toLowerCase()] = m;
      }
    }
    return out;
  }, [data]);
  return { byGroup, isLoading };
}

function LiveGroups({ openSlip }: { openSlip: (m: SlipMarket) => void }) {
  const { byGroup, isLoading } = useGroupWinnerMap();

  if (isLoading) {
    return (
      <div
        style={{
          textAlign: "center",
          fontFamily: "var(--f-tech)",
          fontSize: 13,
          color: "#7889b3",
          padding: "40px 0",
          margin: "0 18px",
        }}
      >
        Loading live group markets...
      </div>
    );
  }

  return (
    <div style={{ margin: "0 18px" }}>
      {Object.entries(GROUPS).map(([g, teams]) => {
        const liveGroup = byGroup.get(g);
        return (
          <div className="gcard" key={g}>
            <div className="gh">
              <span className="gn">
                Group <span>{g}</span>
              </span>
              <span className="gtag">
                {liveGroup && Object.keys(liveGroup).length > 0 ? "Win group · live" : "To advance"}
              </span>
            </div>
            {teams.map((t, i) => {
              const [name, code, pts, od] = t;
              const lm = liveGroup?.[name.toLowerCase()];
              const liveYes =
                lm?.yesPrice != null ? Math.max(1, Math.round(lm.yesPrice * 100)) : null;
              const y = liveYes ?? amImplied(od);

              return (
                // biome-ignore lint/suspicious/noArrayIndexKey: static design-data list
                <div className={`grow${i < 2 ? " qual" : ""}`} key={i}>
                  <span className="pos">{i + 1}</span>
                  <span className="tm">
                    <Flag code={code} size={22} />
                    <span
                      style={{
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {name}
                    </span>
                  </span>
                  <span className="pts">{pts} pts</span>
                  {lm ? (
                    <button
                      type="button"
                      className="adv"
                      onClick={() =>
                        openSlip({
                          q: lm.question,
                          tag: `Group ${g} · win group`,
                          yesL: "YES",
                          noL: "NO",
                          yes: y,
                          no: 100 - y,
                          live: lm,
                        })
                      }
                    >
                      {y}¢
                    </button>
                  ) : (
                    <span
                      className="adv"
                      style={{
                        color: "#7889b3",
                        cursor: "default",
                        fontSize: 10,
                        fontFamily: "var(--f-tech)",
                      }}
                    >
                      ref
                    </span>
                  )}
                </div>
              );
            })}
            <div className="gf">
              <span>Top 2 advance</span>
              <span>
                {liveGroup && Object.keys(liveGroup).length > 0 ? (
                  <span style={{ color: "#34d399", fontSize: 10 }}>live book</span>
                ) : (
                  <span style={{ color: "#7889b3", fontSize: 10 }}>bookie reference</span>
                )}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Live Bracket segment: champion + reach_round from Polymarket ─────────────

const REACH_ROUND_PATTERNS: Array<{ pattern: RegExp; stage: "qf" | "sf" | "fin" }> = [
  { pattern: /Quarter[- ]?final/i, stage: "qf" },
  { pattern: /Semi[- ]?final/i, stage: "sf" },
  { pattern: /Final\b/i, stage: "fin" },
];

function LiveBracket({ openSlip }: { openSlip: (m: SlipMarket) => void }) {
  const { data: championData } = useWcMarkets({ category: "champion" });
  const { data: reachData } = useWcMarkets({ category: "reach_round", limit: 200 });

  // champion map: lowercase team name -> market
  const championMap = useMemo(() => {
    const out: Record<string, WcLiveMarket> = {};
    for (const m of championData?.markets ?? []) {
      const raw = m.teamName ?? m.question.match(/^Will (.+?) win the (2026 )?World Cup/i)?.[1];
      const norm = normalizePmTeamName(raw);
      if (norm) out[norm.toLowerCase()] = m;
    }
    return out;
  }, [championData]);

  // reach_round map: `${lowerTeam}:${stage}` -> market
  const reachMap = useMemo(() => {
    const out: Record<string, WcLiveMarket> = {};
    for (const m of reachData?.markets ?? []) {
      const raw = m.teamName ?? m.question.match(/^Will (.+?) reach/)?.[1] ?? null;
      const norm = normalizePmTeamName(raw);
      const team = norm?.toLowerCase();
      if (!team) continue;
      for (const { pattern, stage } of REACH_ROUND_PATTERNS) {
        if (pattern.test(m.question)) {
          out[`${team}:${stage}`] = m;
          break;
        }
      }
    }
    return out;
  }, [reachData]);

  // Determine the top champion pick from live data (or fall back to BRACKET.champ)
  const topChamp = useMemo(() => {
    const entries = Object.entries(championMap);
    if (entries.length === 0) return null;
    entries.sort((a, b) => (b[1].yesPrice ?? 0) - (a[1].yesPrice ?? 0));
    return entries[0];
  }, [championMap]);

  const champName = topChamp?.[1].teamName
    ? (normalizePmTeamName(topChamp[1].teamName) ?? BRACKET.champ.name)
    : BRACKET.champ.name;
  const champMarket = topChamp?.[1] ?? null;
  const champPct =
    champMarket?.yesPrice != null
      ? Math.max(1, Math.round(champMarket.yesPrice * 100))
      : BRACKET.champ.pct;

  return (
    <>
      <div className="bracket-scroll">
        <div className="bracket">
          {(["qf", "sf", "fin"] as const).map((rk) => (
            <div className={`bcol${rk !== "qf" ? " sf" : ""}`} key={rk}>
              <div className="rl">{BRACKET[rk].label}</div>
              {BRACKET[rk].ties.map((tie, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed 2-slot bracket pairing
                <div className="bmatch" key={i}>
                  {tie.map((entry, j) => {
                    const [code, name, pct, win] = entry as [string, string, number, boolean];
                    const iso = flagSrc(code)
                      ? `https://flagcdn.com/w80/${code.toLowerCase()}.png`
                      : "";
                    const reachKey = `${name.toLowerCase()}:${rk}`;
                    const lm = reachMap[reachKey];
                    const liveYes =
                      lm?.yesPrice != null ? Math.max(1, Math.round(lm.yesPrice * 100)) : null;

                    return (
                      // biome-ignore lint/suspicious/noArrayIndexKey: fixed 2-slot bracket pairing
                      <div className={`bteam${win ? " win" : ""}`} key={j}>
                        <span className="l">
                          {iso && (
                            <img
                              src={iso}
                              alt={code}
                              style={{
                                width: 20,
                                height: 14,
                                objectFit: "cover",
                                borderRadius: 2,
                              }}
                            />
                          )}
                          {name}
                        </span>
                        {lm ? (
                          <button
                            type="button"
                            className="pc"
                            style={{
                              background: "none",
                              border: "none",
                              padding: 0,
                              cursor: "pointer",
                              fontFamily: "var(--f-tech)",
                              fontWeight: 700,
                              fontSize: 11,
                              color: "#34d399",
                            }}
                            onClick={() =>
                              openSlip({
                                q: lm.question,
                                tag: `Bracket · ${BRACKET[rk].label}`,
                                yesL: "YES",
                                noL: "NO",
                                yes: liveYes ?? pct,
                                no: 100 - (liveYes ?? pct),
                                live: lm,
                              })
                            }
                          >
                            {liveYes ?? pct}%
                          </button>
                        ) : (
                          <span className="pc">{pct}%</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ))}
          <div className="bcol" style={{ justifyContent: "center" }}>
            <div className="rl">Champion</div>
            <div style={{ textAlign: "center" }}>
              <div className="trophy">
                <Icon name="cup" size={26} color="#ffd36b" />
              </div>
              <div
                style={{
                  fontFamily: "var(--f-display)",
                  fontWeight: 800,
                  fontSize: 20,
                  color: "#fff",
                }}
              >
                {champName}
              </div>
              <div
                className="mono"
                style={{ color: "#34d399", fontWeight: 700, marginTop: 4, fontSize: 13 }}
              >
                Win it all · {champPct}%
                {champMarket && (
                  <span style={{ color: "#7889b3", fontSize: 10, marginLeft: 4 }}>
                    {fmtVolume(champMarket.volume)}
                  </span>
                )}
              </div>
              {champMarket ? (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ marginTop: 12 }}
                  onClick={() =>
                    openSlip({
                      q: champMarket.question,
                      tag: "Champion",
                      yesL: "YES",
                      noL: "NO",
                      yes: champPct,
                      no: 100 - champPct,
                      live: champMarket,
                    })
                  }
                >
                  Trade champion
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ marginTop: 12, opacity: 0.5, cursor: "not-allowed" }}
                  disabled
                >
                  not yet tradeable
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      <p
        className="mono"
        style={{ fontSize: 11, color: "#7f90b0", margin: "16px 18px 0", lineHeight: 1.5 }}
      >
        Projected bracket from current implied probabilities. Tap a percentage to trade that
        outcome. Live prices from Polymarket.
      </p>
    </>
  );
}

interface WorldCupScreenProps {
  openMatch: (m: WcMatch) => void;
  openSlip: (m: SlipMarket) => void;
  openMarket: (p: SpecialMarket) => void;
}

export function WorldCupScreen({ openMatch, openSlip, openMarket }: WorldCupScreenProps) {
  const [seg, setSeg] = useState("outright");
  // Same query LiveSpecials uses -- deduped by React Query, feeds the stat strip.
  const { data: allData } = useWcMarkets({ limit: 200 });
  const [dateF, setDateF] = useState("all");

  return (
    <div className="screen dark">
      <div className="appbar dark">
        <div>
          <div className="eyebrow" style={{ marginBottom: 4 }}>
            <span className="dot-live" />
            World Cup 2026
          </div>
          <div className="ab-title">World Cup</div>
        </div>
        <span className="grow" />
        <button type="button" className="iconbtn dark" aria-label="Search">
          <Icon name="search" size={20} />
        </button>
      </div>

      <div className="hscroll" style={{ marginTop: 4 }}>
        {[
          ["104", "Matches"],
          ["48", "Teams"],
          [allData ? String(allData.markets.length) : "—", "Open markets"],
          [
            allData ? fmtVolume(allData.markets.reduce((sum, m) => sum + (m.volume ?? 0), 0)) : "—",
            "Total volume",
          ],
        ].map(([v, l], i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: static design-data list
            key={i}
            style={{
              flex: "0 0 auto",
              minWidth: 116,
              background: "rgba(255,255,255,.05)",
              border: "1px solid rgba(255,255,255,.12)",
              borderRadius: 16,
              padding: "13px 15px",
            }}
          >
            <div
              style={{
                fontFamily: "var(--f-display)",
                fontWeight: 800,
                fontSize: 22,
                color: "#fff",
                letterSpacing: "-.02em",
              }}
            >
              {v}
            </div>
            <div
              style={{
                fontFamily: "var(--f-tech)",
                fontSize: 10,
                letterSpacing: ".08em",
                textTransform: "uppercase",
                color: "#8595bd",
                marginTop: 2,
              }}
            >
              {l}
            </div>
          </div>
        ))}
      </div>

      <div style={{ margin: "18px 0 0" }}>
        <FeaturedCard m={FEATURED} onClick={() => openMatch(FEATURED)} />
        <div style={{ margin: "12px 18px 0" }}>
          <button
            type="button"
            className="btn btn-primary btn-block btn-lg"
            onClick={() => openMatch(FEATURED)}
          >
            Trade {FEATURED.h} vs {FEATURED.a} <Icon name="arrow" size={16} color="#fff" />
          </button>
        </div>
      </div>

      <div style={{ height: 22 }} />
      <div className="chiprow">
        {[
          ["outright", "Home"],
          ["groups", "Groups"],
          ["matches", "Matches"],
          ["bracket", "Bracket"],
          ["boot", "Golden Boot"],
          ["specials", "Specials"],
        ].map(([k, l]) => (
          <button
            type="button"
            key={k}
            className={`chip dark${seg === k ? " on" : ""}`}
            onClick={() => setSeg(k ?? "outright")}
          >
            {l}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 16 }}>
        {seg === "outright" && <LiveOutright openSlip={openSlip} />}

        {seg === "groups" && <LiveGroups openSlip={openSlip} />}

        {seg === "matches" && (
          <>
            <div className="chiprow" style={{ marginBottom: 14 }}>
              {["all", ...MATCH_DATES].map((d) => (
                <button
                  type="button"
                  key={d}
                  className={`chip dark${dateF === d ? " on" : ""}`}
                  onClick={() => setDateF(d)}
                >
                  {d === "all" ? "All" : d}
                </button>
              ))}
            </div>
            <div style={{ margin: "0 18px" }}>
              {(dateF === "all" ? WC_MATCHES : WC_MATCHES.filter((m) => m.date === dateF)).map(
                (m, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: static design-data list
                  <MatchCardFull key={i} m={m} onClick={() => openMatch(m)} />
                ),
              )}
            </div>
          </>
        )}

        {seg === "bracket" && <LiveBracket openSlip={openSlip} />}

        {seg === "boot" && <LiveBoot openMarket={openMarket} openSlip={openSlip} />}

        {seg === "specials" && <LiveSpecials openMarket={openMarket} openSlip={openSlip} />}
      </div>

      <Disclaimer dark />
    </div>
  );
}
