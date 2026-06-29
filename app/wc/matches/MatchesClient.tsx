"use client";

import { MatchRow } from "@/components/wc/MatchRow";
import type { Match } from "@/lib/wc2026";
import { type WcLiveMarket, useWcMarkets } from "@/lib/wc2026/usePm";
import { useMemo, useState } from "react";

const ALL = "all" as const;

interface Props {
  matches: readonly Match[];
  dates: readonly string[];
}

/**
 * Build a lookup keyed by `${lowerTeamName}:${isoDate}` from PM match markets.
 * PM question format: "Will Mexico win on 2026-06-11?"
 */
function buildPmMap(markets: readonly WcLiveMarket[]): Record<string, WcLiveMarket> {
  const map: Record<string, WcLiveMarket> = {};
  for (const m of markets) {
    const winMatch = m.question.match(/^Will (.+?) win on (\d{4}-\d{2}-\d{2})\?/);
    const team = winMatch?.[1];
    const date = winMatch?.[2];
    if (team && date) {
      map[`${team.toLowerCase()}:${date}`] = m;
    }
  }
  return map;
}

export function MatchesClient({ matches, dates }: Props) {
  const [filter, setFilter] = useState<string>(ALL);

  const { data } = useWcMarkets({ category: "match" });

  /**
   * PM match markets keyed by `${lowerTeamName}:${isoDate}`.
   * This is the source of truth for team win probabilities on the match card.
   * Static moneyline remains as bookie reference enrichment.
   */
  const pmMap = useMemo(() => buildPmMap(data?.markets ?? []), [data]);

  const visible = filter === ALL ? matches : matches.filter((m) => m.date === filter);

  return (
    <>
      <div className="mhead" style={{ marginBottom: 26 }}>
        <div>
          <h2>All matches · group stage</h2>
          <p className="msub">Jun 11 – Jun 30 · all times local</p>
        </div>
        <fieldset
          className="mfilter"
          style={{ border: "none", padding: 0, margin: 0 }}
          aria-label="Filter by date"
        >
          <button
            type="button"
            className={filter === ALL ? "on" : ""}
            onClick={() => setFilter(ALL)}
          >
            All
          </button>
          {dates.map((d) => (
            <button
              type="button"
              key={d}
              className={filter === d ? "on" : ""}
              onClick={() => setFilter(d)}
            >
              {d}
            </button>
          ))}
        </fieldset>
      </div>

      <div className="mgrid">
        {visible.map((m) => (
          <MatchRow key={m.matchNumber} match={m} pmMap={pmMap} />
        ))}
      </div>

      <p className="disc-d" style={{ marginTop: 24 }}>
        <svg width="15" height="15" viewBox="0 0 15 15" aria-hidden="true">
          <circle cx="7.5" cy="7.5" r="6.5" stroke="#7f90b0" strokeWidth="1.2" fill="none" />
          <path
            d="M7.5 6.6v4M7.5 4.6v.1"
            stroke="#7f90b0"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        Win probabilities: live market-implied where one exists (green dot), bookie reference
        otherwise ("ref"). O/U and venue from static dataset. 18+ only.
      </p>
    </>
  );
}
