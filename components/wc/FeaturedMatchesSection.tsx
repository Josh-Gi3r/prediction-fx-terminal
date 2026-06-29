"use client";

/**
 * FeaturedMatchesSection — fetches PM match markets (client-side) and
 * passes a pmMap into each featured MatchRow.
 * Static moneyline stays as bookie reference enrichment on the card.
 */

import { MatchRow } from "@/components/wc/MatchRow";
import type { Match } from "@/lib/wc2026";
import { type WcLiveMarket, useWcMarkets } from "@/lib/wc2026/usePm";
import { useMemo } from "react";

interface Props {
  matches: readonly Match[];
}

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

export function FeaturedMatchesSection({ matches }: Props) {
  const { data } = useWcMarkets({ category: "match" });
  const pmMap = useMemo(() => buildPmMap(data?.markets ?? []), [data]);

  return (
    <div className="mgrid">
      {matches.map((m) => (
        <MatchRow key={m.matchNumber} match={m} pmMap={pmMap} />
      ))}
    </div>
  );
}
