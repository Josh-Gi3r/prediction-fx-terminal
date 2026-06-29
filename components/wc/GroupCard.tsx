"use client";

import { BetSheet } from "@/components/wc/BetSheet";
import { FlagChip } from "@/components/wc/FlagChip";
import type { GroupId, GroupOdds } from "@/lib/wc2026";
import { parsePercent } from "@/lib/wc2026";
import type { WcLiveMarket } from "@/lib/wc2026/usePm";
import { fmtVolume } from "@/lib/wc2026/usePm";
import { useState } from "react";

interface Props {
  group: GroupId;
  rows: readonly GroupOdds[];
  /**
   * Live Polymarket group_winner markets keyed by lowercase team name.
   * When present, yesPrice drives the displayed probability; static
   * polymarketWinPct is shown only as a "bookie reference" fallback.
   */
  live?: Record<string, WcLiveMarket>;
}

interface SheetState {
  market: WcLiveMarket;
  side: "yes" | "no";
}

export function GroupCard({ group, rows, live }: Props) {
  const [sheet, setSheet] = useState<SheetState | null>(null);

  const sorted = [...rows].sort((a, b) => {
    // Sort by PM price if available, else by static polymarketWinPct
    const lmA = live?.[a.team.toLowerCase()];
    const lmB = live?.[b.team.toLowerCase()];
    const pA = lmA?.yesPrice != null ? lmA.yesPrice * 100 : parsePercent(a.polymarketWinPct);
    const pB = lmB?.yesPrice != null ? lmB.yesPrice * 100 : parsePercent(b.polymarketWinPct);
    return pB - pA;
  });

  function handleAdvance(lm: WcLiveMarket | undefined, team: string, side: "yes" | "no") {
    if (lm) {
      setSheet({ market: lm, side });
    }
    // No live market — button is disabled
  }

  return (
    <>
      <div className="ds4 gcard">
        <div className="gh">
          <span className="gn">
            Group <span>{group}</span>
          </span>
          <span className="tag">Win group</span>
        </div>
        {sorted.map((row, i) => {
          const lm = live?.[row.team.toLowerCase()];
          const pmPct = lm?.yesPrice != null ? lm.yesPrice * 100 : null;
          const displayPct = pmPct ?? parsePercent(row.polymarketWinPct);
          const yesCents = Math.max(1, Math.min(99, Math.round(displayPct)));

          return (
            <div key={row.team} className={`grow${i < 2 ? " qual" : ""}`}>
              <span className="pos">{i + 1}</span>
              <span className="tm">
                <FlagChip team={row.team} />
                {row.team}
              </span>
              <span className="pts">
                {pmPct != null ? (
                  <span style={{ color: "var(--yes)", fontWeight: 700 }}>{pmPct.toFixed(1)}%</span>
                ) : (
                  <span
                    style={{ color: "var(--muted-2)", fontSize: 11 }}
                    title="Bookie reference. No live book."
                  >
                    {row.polymarketWinPct ?? "—"}
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
              {lm ? (
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  <button
                    type="button"
                    className="adv"
                    onClick={() => handleAdvance(lm, row.team, "yes")}
                    aria-label={`YES: ${row.team} wins Group ${group} · ${yesCents}¢`}
                  >
                    {yesCents}¢
                    {lm.volume > 0 && (
                      <span
                        style={{
                          marginLeft: 4,
                          fontSize: 9,
                          fontFamily: "var(--f-tech)",
                          color: "var(--yes)",
                        }}
                      >
                        {fmtVolume(lm.volume)}
                      </span>
                    )}
                  </button>
                </div>
              ) : (
                <span
                  className="adv"
                  style={{
                    color: "var(--muted-2)",
                    cursor: "default",
                    fontSize: 10,
                    fontFamily: "var(--f-tech)",
                  }}
                  title="No live book. Bookie reference only."
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
            {live && Object.keys(live).length > 0 ? (
              <span style={{ color: "var(--yes)", fontSize: 10 }}>live book</span>
            ) : (
              <span style={{ color: "var(--muted-2)", fontSize: 10 }}>bookie reference</span>
            )}
          </span>
        </div>
      </div>

      {sheet && (
        <BetSheet market={sheet.market} initialSide={sheet.side} onClose={() => setSheet(null)} />
      )}
    </>
  );
}
