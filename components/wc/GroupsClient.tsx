"use client";

/**
 * GroupsClient — fetches live Polymarket group_winner markets and distributes
 * them per group to GroupCard. The PM market is the source of truth for any
 * displayed win-group probability; static GroupOdds is reference enrichment.
 */

import { GroupCard } from "@/components/wc/GroupCard";
import type { GroupId, GroupOdds } from "@/lib/wc2026";
import { normalizePmTeamName } from "@/lib/wc2026/teamAlias";
import { type WcLiveMarket, useWcMarkets } from "@/lib/wc2026/usePm";
import { useMemo } from "react";

interface Props {
  groups: readonly GroupId[];
  byGroup: Map<GroupId, GroupOdds[]>;
}

export function GroupsClient({ groups, byGroup }: Props) {
  const { data } = useWcMarkets({ category: "group_winner" });

  /**
   * Build a per-group lookup: groupId → { teamNameLower → WcLiveMarket }.
   * PM teamName drives the lookup; question-parsed team name is fallback.
   */
  const liveByGroup = useMemo(() => {
    const out = new Map<string, Record<string, WcLiveMarket>>();
    for (const m of data?.markets ?? []) {
      if (!m.groupId) continue;
      if (!out.has(m.groupId)) out.set(m.groupId, {});
      const group = out.get(m.groupId)!;

      // PM teamName (e.g. "Mexico") — normalized then lowercased
      if (m.teamName) {
        const norm = normalizePmTeamName(m.teamName);
        if (norm) group[norm.toLowerCase()] = m;
      }

      // Also parse from question: "Will X win Group A..."
      const qMatch = m.question.match(/^Will (.+?) win Group/);
      if (qMatch?.[1]) {
        const parsed = normalizePmTeamName(qMatch[1]);
        if (parsed) group[parsed.toLowerCase()] = m;
      }
    }
    return out;
  }, [data]);

  return (
    <div className="grp-grid">
      {groups.map((g: GroupId) => {
        const rows = byGroup.get(g) ?? [];
        const live = liveByGroup.get(g);
        return <GroupCard key={g} group={g} rows={rows} live={live} />;
      })}
    </div>
  );
}
