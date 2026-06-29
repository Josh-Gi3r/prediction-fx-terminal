"use client";

import { BetSheet } from "@/components/wc/BetSheet";
import { FlagChip } from "@/components/wc/FlagChip";
import { type OutrightOdds, parsePercent } from "@/lib/wc2026";
import { type WcLiveMarket, fmtVolume } from "@/lib/wc2026/usePm";
import Link from "next/link";
import { useState } from "react";

interface Props {
  teams: readonly OutrightOdds[];
  maxPct: number;
  /** Live Polymarket champion markets keyed by lowercase team name. */
  live?: Record<string, WcLiveMarket>;
}

interface SheetState {
  market: WcLiveMarket;
  side: "yes" | "no";
}

export function OutrightTable({ teams, maxPct, live }: Props) {
  const [sheet, setSheet] = useState<SheetState | null>(null);

  function openBet(lm: WcLiveMarket | undefined, side: "yes" | "no") {
    if (lm) {
      setSheet({ market: lm, side });
    }
    // No live market — button is disabled, no action needed
  }

  return (
    <>
      <div className="ds4 ot" id="outright">
        <div className="ot-h">
          <span>#</span>
          <span>Team</span>
          <span className="col-grp">Group</span>
          <span>Implied · live</span>
          <span className="col-dk" style={{ textAlign: "right" }}>
            DraftKings
          </span>
          <span style={{ textAlign: "center" }}>Trade</span>
        </div>
        <ol style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {teams.map((t, idx) => {
            const lm = live?.[t.team.toLowerCase()];
            // Only use PM price if we have a live market — static polymarketPct is reference
            const pmPct = lm?.yesPrice != null ? lm.yesPrice * 100 : null;
            const displayPct = pmPct ?? parsePercent(t.polymarketPct);
            const yesCents = Math.max(1, Math.min(99, Math.round(displayPct)));
            const barWidth = maxPct > 0 ? (displayPct / maxPct) * 100 : 0;

            return (
              <li key={t.team} className="ot-r" style={{ position: "relative" }}>
                {/* Clickable row → market detail (only when a live PM book exists).
                    Stretched-link overlay; YES/NO buttons sit above it (z-index). */}
                {lm && (
                  <Link
                    href={`/wc/m/${lm.key}`}
                    className="ot-rowlink"
                    aria-label={`Open market: Will ${t.team} win the 2026 World Cup?`}
                  />
                )}
                <span className="rk">{(idx + 1).toString().padStart(2, "0")}</span>
                <span className="team">
                  <FlagChip team={t.team} />
                  {t.team}
                  {lm && (
                    <span
                      style={{
                        marginLeft: 6,
                        fontSize: 10,
                        fontFamily: "var(--f-tech)",
                        color: "var(--yes)",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 3,
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: "var(--yes)",
                          display: "inline-block",
                          animation: "pulse 1.8s infinite",
                        }}
                      />
                      {fmtVolume(lm.volume)}
                    </span>
                  )}
                </span>
                <span className="grp col-grp">{t.group ?? "—"}</span>
                <span className="impc">
                  <span className="bar">
                    <i style={{ width: `${barWidth}%` }} />
                  </span>
                  <span className="pct">
                    {pmPct != null ? (
                      `${pmPct.toFixed(1)}%`
                    ) : (
                      <span
                        title="Bookie reference. No live book for this team."
                        style={{ color: "var(--muted-2)", fontSize: 11 }}
                      >
                        {t.polymarketPct ?? "—"}
                        <span
                          style={{
                            marginLeft: 4,
                            fontSize: 9,
                            fontFamily: "var(--f-tech)",
                            textTransform: "uppercase",
                            letterSpacing: ".04em",
                            color: "var(--muted-2)",
                          }}
                        >
                          ref
                        </span>
                      </span>
                    )}
                  </span>
                </span>
                <span className="dk col-dk">{t.draftkings ?? "—"}</span>
                <span className="ynx" style={{ position: "relative", zIndex: 2 }}>
                  {lm ? (
                    <>
                      <button
                        type="button"
                        className="y"
                        onClick={() => openBet(lm, "yes")}
                        aria-label={`YES on ${t.team} to win · ${yesCents}¢`}
                      >
                        YES
                        <small>{yesCents}¢</small>
                      </button>
                      <button
                        type="button"
                        className="n"
                        onClick={() => openBet(lm, "no")}
                        aria-label={`NO on ${t.team} to win · ${100 - yesCents}¢`}
                      >
                        NO
                        <small>{100 - yesCents}¢</small>
                      </button>
                    </>
                  ) : (
                    <span
                      style={{
                        fontSize: 11,
                        fontFamily: "var(--f-tech)",
                        color: "var(--muted-2)",
                        textAlign: "center",
                        display: "block",
                        padding: "0 4px",
                      }}
                      title="No live book for this team"
                    >
                      reference only
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      {sheet && (
        <BetSheet market={sheet.market} initialSide={sheet.side} onClose={() => setSheet(null)} />
      )}
    </>
  );
}
