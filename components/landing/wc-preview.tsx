import { FlagChip } from "@/components/wc/FlagChip";
import { OUTRIGHT_ODDS } from "@/lib/wc2026";
import { visibleMarkets } from "@/lib/wc2026/pm";
import Link from "next/link";

/**
 * World Cup teaser — design-v2 index.html (.wc-tease / .otable) structure,
 * but the tradeable prices come from the PM registry snapshot (server-side,
 * zero network) instead of the static dataset. DraftKings stays as static
 * bookie comparison color only. Server component, zero client JS.
 */
export function WcPreview() {
  // Champion markets from the registry snapshot, favorites first.
  const champions = visibleMarkets({ category: "champion" })
    .map((m) => ({ ...m, yes: m.snapshot?.yesPrice != null ? Number(m.snapshot.yesPrice) : null }))
    .filter((m) => m.teamName && m.yes != null && !Number.isNaN(m.yes))
    .sort((a, b) => (b.yes ?? 0) - (a.yes ?? 0))
    .slice(0, 8);

  // Static rows keyed by team for the bookie-odds comparison column.
  const staticByTeam = new Map(OUTRIGHT_ODDS.map((t) => [t.team, t]));
  const maxPct = Math.max(0.01, ...champions.map((m) => m.yes ?? 0));

  return (
    <section className="section wc-tease" data-screen-label="Home / World Cup teaser">
      <div className="wrap">
        <div className="between" style={{ flexWrap: "wrap", gap: 16, marginBottom: 8 }}>
          <div>
            <span className="eyebrow">
              <span className="dot-live" style={{ background: "var(--no)" }} />
              World Cup 2026 · 104 matches · 48 teams
            </span>
            <h2 style={{ marginTop: 14, maxWidth: 680 }}>Who wins the World Cup?</h2>
            <p className="lead" style={{ marginTop: 10, maxWidth: 560 }}>
              The favorites, priced live by the prediction market. Each percentage is the market's current
              chance that the team wins it all. Back YES or NO on any of the 48 teams.
            </p>
          </div>
          <Link className="btn btn-ghost" href="/wc">
            See all markets
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path
                d="M3 8h9M8 3l5 5-5 5"
                stroke="currentColor"
                strokeWidth="1.8"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        </div>

        <div className="otable" style={{ marginTop: 24 }}>
          <div className="oh">
            <span>#</span>
            <span>Team</span>
            <span>Group</span>
            <span>Chance to win it all</span>
            <span style={{ textAlign: "right" }}>Bookie odds (DraftKings)</span>
          </div>
          {champions.map((m, idx) => {
            const team = m.teamName as string;
            const pct = (m.yes ?? 0) * 100;
            const barWidth = ((m.yes ?? 0) / maxPct) * 100;
            const stat = staticByTeam.get(team);
            return (
              <Link className="orow" key={m.key} href={`/wc/m/${m.key}`}>
                <span className="rk">{(idx + 1).toString().padStart(2, "0")}</span>
                <span className="team">
                  <FlagChip team={team} />
                  {team}
                </span>
                <span className="grp">{m.groupId ?? stat?.group ?? "—"}</span>
                <span className="imp">
                  <span className="bar">
                    <i style={{ width: `${barWidth}%` }} />
                  </span>
                  <span className="pct">{pct.toFixed(pct < 10 ? 1 : 0)}%</span>
                </span>
                <span className="dk">{stat?.draftkings ?? "—"}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
