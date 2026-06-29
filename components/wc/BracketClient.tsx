"use client";

/**
 * BracketClient — fetches PM champion, advance_ko, and reach_round markets
 * and overlays them on static KnockoutOdds enrichment.
 *
 * Data truth rule: any percentage shown as tradeable must come from the live
 * PM registry. Static KnockoutOdds fields (toReachQF, toReachSemis, etc.)
 * are labeled "ref" when no PM market exists for that team × stage.
 */

import { BetSheet } from "@/components/wc/BetSheet";
import { FlagChip } from "@/components/wc/FlagChip";
import type { KnockoutOdds } from "@/lib/wc2026";
import { parsePercent } from "@/lib/wc2026";
import { normalizePmTeamName as normTeam } from "@/lib/wc2026/teamAlias";
import { type WcLiveMarket, fmtVolume, useWcMarkets } from "@/lib/wc2026/usePm";
import Link from "next/link";
import { useMemo, useState } from "react";

interface Props {
  knockoutOdds: readonly KnockoutOdds[];
}

/** Maps PM "reach_round" question patterns to stage keys. */
const REACH_ROUND_PATTERNS: Array<{ pattern: RegExp; stage: StageKey }> = [
  { pattern: /Quarter[- ]?final/i, stage: "toReachQF" },
  { pattern: /Semi[- ]?final/i, stage: "toReachSemis" },
  { pattern: /Final\b/i, stage: "toReachFinal" },
  { pattern: /Round of 16/i, stage: "toReachR16" },
];

type StageKey = "toReachQF" | "toReachSemis" | "toReachFinal" | "toReachR16";

const STAGES: Array<{
  id: string;
  label: string;
  staticKey: StageKey | "polymarketWinPct";
  pmCategory: "reach_round" | "advance_ko" | "champion";
  pmStage?: StageKey;
  limit: number;
}> = [
  {
    id: "QF",
    label: "Quarter-finals",
    staticKey: "toReachQF",
    pmCategory: "reach_round",
    pmStage: "toReachQF",
    limit: 8,
  },
  {
    id: "SF",
    label: "Semi-finals",
    staticKey: "toReachSemis",
    pmCategory: "reach_round",
    pmStage: "toReachSemis",
    limit: 4,
  },
  {
    id: "F",
    label: "Final",
    staticKey: "toReachFinal",
    pmCategory: "reach_round",
    pmStage: "toReachFinal",
    limit: 2,
  },
  {
    id: "W",
    label: "Champion",
    staticKey: "polymarketWinPct",
    pmCategory: "champion",
    limit: 2,
  },
] as const;

/**
 * Format a static odds/multiplier field as a percentage.
 * - Already a "%" string → return as-is (e.g. "18%").
 * - Multiplier "4.33x" or "4.33" → implied probability = 1/n.
 * - American moneyline format does NOT appear in toReach* fields.
 */
function fmtStaticPct(value: string | null | undefined): string {
  if (!value) return "—";
  if (value.includes("%")) return value;
  // Multiplier format "Nx" → 1/N probability
  const m = value.match(/(\d+(?:\.\d+)?)/);
  if (!m?.[1]) return value;
  const n = Number.parseFloat(m[1]);
  if (Number.isNaN(n) || n <= 0) return value;
  return `${Math.round((1 / n) * 100)}%`;
}

interface SheetState {
  market: WcLiveMarket;
  side: "yes" | "no";
}

export function BracketClient({ knockoutOdds }: Props) {
  const [sheet, setSheet] = useState<SheetState | null>(null);

  const { data: championData } = useWcMarkets({ category: "champion" });
  const { data: reachData } = useWcMarkets({ category: "reach_round", limit: 200 });

  /** champion markets keyed by lowercase team name */
  const championMap = useMemo(() => {
    const map: Record<string, WcLiveMarket> = {};
    for (const m of championData?.markets ?? []) {
      if (m.teamName) map[normTeam(m.teamName)?.toLowerCase() ?? ""] = m;
    }
    return map;
  }, [championData]);

  /**
   * reach_round markets keyed by `${lowerTeamName}:${stageKey}`.
   * We parse the question to detect which round is referenced.
   */
  const reachMap = useMemo(() => {
    const map: Record<string, WcLiveMarket> = {};
    for (const m of reachData?.markets ?? []) {
      const teamRaw = m.teamName ?? m.question.match(/^Will (.+?) reach/)?.[1] ?? null;
      const team = normTeam(teamRaw)?.toLowerCase();
      if (!team) continue;
      for (const { pattern, stage } of REACH_ROUND_PATTERNS) {
        if (pattern.test(m.question)) {
          map[`${team}:${stage}`] = m;
          break;
        }
      }
    }
    return map;
  }, [reachData]);

  /**
   * Sort by PM champion yesPrice DESC, fall back to static polymarketWinPct.
   */
  const sorted = useMemo(() => {
    return [...knockoutOdds].sort((a, b) => {
      const pmA = championMap[a.team.toLowerCase()]?.yesPrice;
      const pmB = championMap[b.team.toLowerCase()]?.yesPrice;
      if (pmA != null && pmB != null) return pmB - pmA;
      if (pmA != null) return -1;
      if (pmB != null) return 1;
      return parsePercent(b.polymarketWinPct) - parsePercent(a.polymarketWinPct);
    });
  }, [knockoutOdds, championMap]);

  const champion = sorted[0];

  function getLiveMarket(team: string, stage: (typeof STAGES)[number]): WcLiveMarket | undefined {
    const key = team.toLowerCase();
    if (stage.id === "W") return championMap[key];
    if (stage.pmStage) return reachMap[`${key}:${stage.pmStage}`];
    return undefined;
  }

  function getPct(
    t: KnockoutOdds,
    stage: (typeof STAGES)[number],
  ): { pm: number | null; static: string | null } {
    const lm = getLiveMarket(t.team, stage);
    const pmPct = lm?.yesPrice != null ? lm.yesPrice * 100 : null;
    const staticVal = t[stage.staticKey as keyof KnockoutOdds] as string | null | undefined;
    return { pm: pmPct, static: staticVal ?? null };
  }

  return (
    <>
      {/* 5-column bracket: QF · SF · Final · Champion · (champion detail) */}
      <div className="bracket-scroll">
        <div className="bracket" style={{ gridTemplateColumns: "repeat(5, 1fr)", minWidth: 720 }}>
          {STAGES.map((stage) => {
            const teams = sorted.slice(0, stage.limit);
            return (
              <div key={stage.id} className="bcol">
                <div className="rl">{stage.label}</div>
                <div className="bmatch">
                  {teams.map((t, idx) => {
                    const isWin = idx % 2 === 0;
                    const { pm, static: staticVal } = getPct(t, stage);
                    const lm = getLiveMarket(t.team, stage);

                    return (
                      <div key={t.team} className={`bteam${isWin ? " win" : ""}`}>
                        <span className="l">
                          <FlagChip team={t.team} className="bflag" />
                          {t.team}
                        </span>
                        <span className="pc">
                          {pm != null ? (
                            <span
                              style={{
                                color: "var(--yes)",
                                fontFamily: "var(--f-tech)",
                                fontWeight: 700,
                              }}
                            >
                              {pm.toFixed(1)}%
                              {lm && lm.volume > 0 && (
                                <span
                                  style={{ fontSize: 9, marginLeft: 3, color: "var(--muted-2)" }}
                                >
                                  {fmtVolume(lm.volume)}
                                </span>
                              )}
                            </span>
                          ) : (
                            <span
                              style={{ color: "var(--muted-2)", fontSize: 11 }}
                              title="Bookie reference. No live book."
                            >
                              {fmtStaticPct(staticVal)}
                              <span
                                style={{
                                  marginLeft: 3,
                                  fontSize: 9,
                                  fontFamily: "var(--f-tech)",
                                  textTransform: "uppercase",
                                  letterSpacing: ".04em",
                                }}
                              >
                                ref
                              </span>
                            </span>
                          )}
                        </span>
                        {lm && (
                          <button
                            type="button"
                            style={{
                              marginTop: 4,
                              padding: "2px 7px",
                              fontSize: 10,
                              fontFamily: "var(--f-tech)",
                              fontWeight: 700,
                              color: "#fff",
                              background: "var(--yes)",
                              border: "none",
                              borderRadius: "var(--r)",
                              cursor: "pointer",
                            }}
                            onClick={() => setSheet({ market: lm, side: "yes" })}
                            aria-label={`YES on ${t.team} · ${stage.label}`}
                          >
                            YES
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Champion column — 5th column, always rendered */}
          {champion && (
            <div
              className="bcol"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                paddingTop: 28,
              }}
            >
              <div className="rl">Top pick</div>
              <div className="trophy" aria-label="Trophy">
                <svg width="26" height="26" viewBox="0 0 46 46" aria-hidden="true">
                  <path
                    d="M14 9h18v6a9 9 0 01-18 0V9z"
                    stroke="var(--brand)"
                    strokeWidth="2"
                    fill="rgba(37,99,235,.1)"
                  />
                  <path
                    d="M14 12H9v3a5 5 0 005 5M32 12h5v3a5 5 0 01-5 5M19 27h8M17 33h12M21 24v3M25 24v3"
                    stroke="var(--brand)"
                    strokeWidth="2"
                    fill="none"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <div
                style={{
                  fontFamily: "var(--f-display)",
                  fontWeight: 800,
                  fontSize: 20,
                  color: "var(--ink)",
                  marginTop: 8,
                  textAlign: "center",
                }}
              >
                {champion.team}
              </div>
              {(() => {
                const lm = championMap[champion.team.toLowerCase()];
                const pmPct = lm?.yesPrice != null ? `${(lm.yesPrice * 100).toFixed(1)}%` : null;
                return (
                  <div
                    className="mono"
                    style={{
                      color: pmPct ? "var(--yes)" : "var(--muted-2)",
                      fontWeight: 700,
                      fontSize: 13,
                      marginTop: 4,
                    }}
                  >
                    {pmPct ? (
                      <>
                        {pmPct} to win
                        {lm && lm.volume > 0 && (
                          <span style={{ marginLeft: 5, fontSize: 10, color: "var(--muted-2)" }}>
                            {fmtVolume(lm.volume)}
                          </span>
                        )}
                      </>
                    ) : (
                      <span title="Bookie reference. No live PM market.">
                        {champion.polymarketWinPct ?? fmtStaticPct(champion.toWin)} ref
                      </span>
                    )}
                  </div>
                );
              })()}
              {(() => {
                const lm = championMap[champion.team.toLowerCase()];
                return lm ? (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    style={{ marginTop: 14 }}
                    onClick={() => setSheet({ market: lm, side: "yes" })}
                  >
                    Predict champion
                  </button>
                ) : (
                  <Link href="/wc" className="btn btn-primary btn-sm" style={{ marginTop: 14 }}>
                    Predict champion
                  </Link>
                );
              })()}
            </div>
          )}
        </div>
      </div>

      {sheet && (
        <BetSheet market={sheet.market} initialSide={sheet.side} onClose={() => setSheet(null)} />
      )}
    </>
  );
}
