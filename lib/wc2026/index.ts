export * from "./types";
export * from "./data";

import { GROUP_ODDS, MATCHES, OUTRIGHT_ODDS, SQUADS } from "./data";
import type { GroupId, Match, OutrightOdds, SquadPlayer } from "./types";

/** Group an array by a key, preserving insertion order. */
function groupBy<T, K extends string>(rows: readonly T[], keyOf: (row: T) => K): Map<K, T[]> {
  const out = new Map<K, T[]>();
  for (const row of rows) {
    const k = keyOf(row);
    const bucket = out.get(k);
    if (bucket) bucket.push(row);
    else out.set(k, [row]);
  }
  return out;
}

/** All 48 teams ordered by descending Polymarket implied probability. */
export function topTeams(limit?: number): OutrightOdds[] {
  const ranked = [...OUTRIGHT_ODDS].sort((a, b) => {
    const ap = parsePercent(a.polymarketPct);
    const bp = parsePercent(b.polymarketPct);
    return bp - ap;
  });
  return typeof limit === "number" ? ranked.slice(0, limit) : ranked;
}

/** Matches for a given group, in match-number order. */
export function matchesForGroup(group: GroupId): Match[] {
  return MATCHES.filter((m) => m.group === group);
}

/** Squad roster for a given team. */
export function squadForTeam(team: string): SquadPlayer[] {
  return SQUADS.filter((p) => p.team === team);
}

/** Teams grouped by their group letter (A–L). */
export function teamsByGroup(): Map<GroupId, OutrightOdds[]> {
  return groupBy(
    OUTRIGHT_ODDS.filter((t) => t.group !== null) as Array<OutrightOdds & { group: GroupId }>,
    (t) => t.group as GroupId,
  );
}

/** Group-stage odds bucketed by group letter. */
export function groupOddsByGroup() {
  return groupBy(GROUP_ODDS, (g) => g.group);
}

/** Parse a "18%" / "8.5%" / null string into a number, returning 0 on miss. */
export function parsePercent(s: string | null | undefined): number {
  if (!s) return 0;
  const m = s.match(/-?\d+(?:\.\d+)?/);
  return m ? Number.parseFloat(m[0]) : 0;
}

/** Parse an American moneyline ("+500", "-185") into implied probability (0..1). */
export function moneylineToProb(s: string | null | undefined): number {
  if (!s) return 0;
  const m = s.match(/[+-]?\d+/);
  if (!m) return 0;
  const n = Number.parseInt(m[0], 10);
  if (Number.isNaN(n)) return 0;
  if (n > 0) return 100 / (n + 100);
  return -n / (-n + 100);
}
