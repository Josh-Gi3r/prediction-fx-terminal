"use client";

/**
 * FeaturedFmd — the home-hub featured-match panel + golden-boot mini.
 *
 * Transplanted from wc.html (.fmd-row → .fmd + .gbmini). The featured tie is
 * the highest-volume live PM `match` market; the golden-boot mini is the top
 * live PM `golden_boot` markets. Flags via flagcdn (iso.ts). Trade button on
 * the featured match links to its market detail; golden-boot rows link to the
 * Golden Boot page. No made-up odds — everything here is live or omitted.
 */

import { flagUrl } from "@/components/wc/iso";
import { resolvePlayerVisual } from "@/lib/wc2026/playerVisual";
import { type WcLiveMarket, fmtVolume, useWcMarkets } from "@/lib/wc2026/usePm";
import Link from "next/link";
import { useMemo } from "react";

const ArrowIcon = () => (
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
);

/** "Will Brazil win on 2026-07-11?" → "Brazil" */
function parseWinTeam(question: string): string | null {
  const m = question.match(/^Will (.+?) win on \d{4}-\d{2}-\d{2}\?/);
  return m?.[1] ?? null;
}

/**
 * "Mexico vs. South Africa" + team "Mexico" → "South Africa" (the opponent).
 * The PM `match` market is "Will [team] win the match?"; the other side of the
 * eventTitle is the real opponent — far clearer than the jargon "Field".
 */
function parseOpponent(eventTitle: string | null, team: string | null): string | null {
  if (!eventTitle || !team) return null;
  const sides = eventTitle.split(/\s+vs\.?\s+/i).map((s) => s.trim());
  if (sides.length !== 2) return null;
  const [a, b] = sides;
  if (!a || !b) return null;
  const t = team.toLowerCase();
  if (a.toLowerCase() === t) return b;
  if (b.toLowerCase() === t) return a;
  return null;
}

/** Golden boot question → player name. */
function parseBootPlayer(question: string): string {
  const m = question.match(/^Will (.+?) (?:be the top goalscorer|win the Golden Boot)/i);
  return m?.[1] ?? question;
}

function liquidityLabel(liq: number): { text: string; color: string } {
  if (liq >= 50_000) return { text: "High", color: "#34d399" };
  if (liq >= 10_000) return { text: "Med", color: "#fbbf24" };
  return { text: "Building", color: "#9fb0d8" };
}

export function FeaturedFmd() {
  const { data: matchData } = useWcMarkets({ category: "match" });
  const { data: bootData } = useWcMarkets({ category: "golden_boot" });

  // Featured = highest-volume live match market with a parseable team + opponent
  const featured = useMemo(() => {
    const markets = (matchData?.markets ?? []).filter((m) => m.yesPrice != null);
    return [...markets].sort((a, b) => b.volume - a.volume)[0] ?? null;
  }, [matchData]);

  const bootTop = useMemo(() => {
    const markets = (bootData?.markets ?? []).filter((m) => m.yesPrice != null);
    return [...markets].sort((a, b) => (b.yesPrice ?? 0) - (a.yesPrice ?? 0)).slice(0, 6);
  }, [bootData]);

  return (
    <div className="fmd-row">
      {featured ? <FeaturedMatchPanel market={featured} /> : <FeaturedMatchPanelEmpty />}
      <GoldenBootMini markets={bootTop} />
    </div>
  );
}

function FeaturedMatchPanel({ market }: { market: WcLiveMarket }) {
  const team = market.teamName ?? parseWinTeam(market.question);
  const opponent = parseOpponent(market.eventTitle, team);
  const yes = market.yesPrice != null ? Math.round(market.yesPrice * 100) : null;
  const teamFlag = flagUrl(team, 80);
  const oppFlag = flagUrl(opponent, 80);
  const liq = liquidityLabel(market.liquidity);

  return (
    <div className="fmd">
      <div className="fmd-head">
        <span className="ft">
          <span className="dot-live" />
          Featured Match
        </span>
        <span className="qf">{market.eventTitle || "World Cup"}</span>
      </div>

      <div className="fmd-teams">
        <div className="t">
          {teamFlag ? (
            <img className="fl" src={teamFlag} alt={team ?? ""} />
          ) : (
            <span className="fl" aria-hidden="true" />
          )}
          <div className="nm">{team ?? market.outcomeLabel ?? "—"}</div>
        </div>
        <div className="mid">
          <div className="cd">{yes != null ? `${yes}%` : "—"}</div>
          <div className="cdl">{team ? `${team.toUpperCase()} TO WIN` : "LIVE CHANCE"}</div>
        </div>
        <div className="t">
          {oppFlag ? (
            <img className="fl" src={oppFlag} alt={opponent ?? ""} />
          ) : (
            <span className="fl" aria-hidden="true" />
          )}
          <div className="nm">{opponent ?? "Opponent"}</div>
        </div>
      </div>

      <div className="fmd-venue">
        {team
          ? `Will ${team} beat ${opponent ?? "their opponent"}? Buy YES if they win the match.`
          : market.question}
      </div>

      <div className="fmd-prob">
        <span className="pp h">{yes != null ? `${yes}%` : "—"}</span>
        <div className="tribar">
          <i className="h" style={{ width: `${yes ?? 50}%` }} />
          <i className="a" style={{ width: `${100 - (yes ?? 50)}%` }} />
        </div>
        <span className="pp a">{yes != null ? `${100 - yes}%` : "—"}</span>
      </div>

      <div className="fmd-stats">
        <div className="s">
          <div className="sv">{fmtVolume(market.volume)}</div>
          <div className="sl">Total volume</div>
        </div>
        <div className="s">
          <div className="sv">{fmtVolume(market.liquidity)}</div>
          <div className="sl">Liquidity</div>
        </div>
        <div className="s">
          <div className="sv" style={{ color: liq.color }}>
            {liq.text}
          </div>
          <div className="sl">Book depth</div>
        </div>
      </div>

      <Link className="btn btn-primary btn-block" href={`/wc/m/${market.key}`}>
        Trade this match
        <ArrowIcon />
      </Link>
    </div>
  );
}

function FeaturedMatchPanelEmpty() {
  return (
    <div className="fmd">
      <div className="fmd-head">
        <span className="ft">
          <span className="dot-live" />
          Featured Match
        </span>
        <span className="qf">World Cup</span>
      </div>
      <div
        style={{
          padding: "40px 8px",
          textAlign: "center",
          color: "#9fb0d8",
          fontFamily: "var(--f-tech)",
          fontSize: 13.5,
        }}
      >
        No live match market yet. The featured tie appears once books open.
      </div>
      <Link className="btn btn-primary btn-block" href="/wc/matches">
        Browse matches
        <ArrowIcon />
      </Link>
    </div>
  );
}

function GoldenBootMini({ markets }: { markets: readonly WcLiveMarket[] }) {
  return (
    <aside className="gbmini">
      <div className="gbmini-head">
        <span className="ttl">★ Golden Boot</span>
        <Link href="/wc/boot">All →</Link>
      </div>
      <div className="sub">Tournament top scorer</div>
      <div className="gbmini-list">
        {markets.length === 0
          ? [0, 1, 2, 3].map((i) => (
              <div className="r" key={`gb-sk-${i}`}>
                <span className="rk">{i + 1}</span>
                <span className="fl" />
                <span className="nm" style={{ color: "#7889b3" }}>
                  Loading…
                </span>
                <span className="od">—</span>
              </div>
            ))
          : markets.map((m, i) => {
              const player = parseBootPlayer(m.question);
              const pv = resolvePlayerVisual(player, m.icon);
              // Photo first (matches the main Boot table); fall back to flag img.
              const photo = pv.type === "photo" ? pv.value : null;
              const flag = flagUrl(pv.team, 40);
              const yes = m.yesPrice != null ? Math.round(m.yesPrice * 100) : null;
              return (
                <Link className="r" href="/wc/boot" key={m.key}>
                  <span className="rk">{i + 1}</span>
                  {photo ? (
                    <img className="fl pl-photo" src={photo} alt="" aria-hidden="true" />
                  ) : flag ? (
                    <img className="fl" src={flag} alt="" aria-hidden="true" />
                  ) : (
                    <span className="fl" />
                  )}
                  <span className="nm">{player}</span>
                  <span className="od">{yes != null ? `${yes}¢` : "—"}</span>
                </Link>
              );
            })}
      </div>
    </aside>
  );
}
