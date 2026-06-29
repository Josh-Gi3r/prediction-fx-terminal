"use client";

/**
 * MatchDetail — single-fixture detail surface.
 *
 * Transplanted from wc-match.html (.mhero dark stadium hero + .dx two-column
 * trading layout). Win probabilities and the tradeable YES/NO markets come
 * from live PM `match` markets ("Will <team> win on <date>?"); static MATCHES
 * provides enrichment (venue, kickoff date, moneyline reference, accent
 * colors). Every YES/NO opens BetSheet against the real CLOB market; when no
 * live book exists for a side, the row says so — never a fake fill.
 */

import { toast } from "@/components/ui/toast";
import { BetSheet } from "@/components/wc/BetSheet";
import { flagUrl } from "@/components/wc/iso";
import { type Match, moneylineToProb } from "@/lib/wc2026";
import { teamCardSlug } from "@/lib/wc2026/teamCard";
import { type WcLiveMarket, fmtVolume, useWcMarkets } from "@/lib/wc2026/usePm";
import Link from "next/link";
import { useMemo, useState } from "react";

const MONTH_MAP: Record<string, string> = {
  Jan: "01",
  Feb: "02",
  Mar: "03",
  Apr: "04",
  May: "05",
  Jun: "06",
  Jul: "07",
  Aug: "08",
  Sep: "09",
  Oct: "10",
  Nov: "11",
  Dec: "12",
};

function staticDateToPmDate(date: string): string | null {
  const parts = date.match(/^(\w{3})\s+(\d+)$/);
  if (!parts) return null;
  const mon = parts[1];
  const day = parts[2];
  if (!mon || !day) return null;
  const mm = MONTH_MAP[mon];
  if (!mm) return null;
  return `2026-${mm}-${day.padStart(2, "0")}`;
}

const PM_NAME_VARIANTS: Record<string, string[]> = {
  "South Korea": ["Korea Republic", "South Korea"],
  "United States": ["United States", "USA"],
  Iran: ["IR Iran", "Iran"],
  Turkey: ["Türkiye", "Turkey"],
  "Bosnia-Herz.": ["Bosnia and Herzegovina", "Bosnia-Herz."],
};

function buildWinMap(markets: readonly WcLiveMarket[]): Record<string, WcLiveMarket> {
  const map: Record<string, WcLiveMarket> = {};
  for (const m of markets) {
    const win = m.question.match(/^Will (.+?) win on (\d{4}-\d{2}-\d{2})\?/);
    if (win?.[1] && win[2]) map[`${win[1].toLowerCase()}:${win[2]}`] = m;
  }
  return map;
}

function findWin(
  team: string,
  date: string,
  map: Record<string, WcLiveMarket>,
): WcLiveMarket | null {
  const iso = staticDateToPmDate(date);
  if (!iso) return null;
  const variants = PM_NAME_VARIANTS[team] ?? [team];
  for (const v of variants) {
    const hit = map[`${v.toLowerCase()}:${iso}`];
    if (hit) return hit;
  }
  return null;
}

function teamColor(name: string): string {
  const c: Record<string, string> = {
    Brazil: "#199e43",
    France: "#11457e",
    Argentina: "#75aadb",
    England: "#cf142b",
    Spain: "#c60b1e",
    Germany: "#1a1a1a",
    Portugal: "#c8102e",
    Netherlands: "#ec5800",
    Mexico: "#199e43",
    "United States": "#3c3b6e",
    Morocco: "#c1272d",
    Japan: "#bc002d",
    Canada: "#d52b1e",
    Switzerland: "#d52b1e",
    Turkey: "#e30a17",
    Australia: "#00843d",
    Uruguay: "#5bcaff",
    Colombia: "#fcd116",
    Scotland: "#0065bf",
    Haiti: "#00209f",
    Qatar: "#8a1538",
    "South Korea": "#cd2e3a",
    "South Africa": "#c8102e",
    Norway: "#ba0c2f",
    Paraguay: "#d52b1e",
    Curaçao: "#003da5",
    Iraq: "#007a3d",
  };
  return c[name] ?? "#2563eb";
}

interface SheetState {
  market: WcLiveMarket;
  side: "yes" | "no";
}

export function MatchDetail({ match }: { match: Match }) {
  const { data } = useWcMarkets({ category: "match" });
  const [sheet, setSheet] = useState<SheetState | null>(null);

  const winMap = useMemo(() => buildWinMap(data?.markets ?? []), [data]);
  const homePm = findWin(match.homeTeam, match.date, winMap);
  const awayPm = findWin(match.awayTeam, match.date, winMap);

  // Probabilities: live PM where available, static moneyline as fallback
  const sHome = moneylineToProb(match.moneylineHome);
  const sDraw = moneylineToProb(match.drawTie);
  const sAway = moneylineToProb(match.moneylineAway);
  const sTotal = sHome + sDraw + sAway || 1;

  const pHome = homePm?.yesPrice != null ? homePm.yesPrice : sHome / sTotal;
  const pAway = awayPm?.yesPrice != null ? awayPm.yesPrice : sAway / sTotal;
  const pDraw =
    homePm?.yesPrice != null && awayPm?.yesPrice != null
      ? Math.max(0, 1 - pHome - pAway)
      : sDraw / sTotal;
  const barTotal = pHome + pDraw + pAway || 1;

  const hColor = teamColor(match.homeTeam);
  const aColor = teamColor(match.awayTeam);
  const hFlag = flagUrl(match.homeTeam, 80);
  const aFlag = flagUrl(match.awayTeam, 80);
  const hCard = teamCardSlug(match.homeTeam);
  const aCard = teamCardSlug(match.awayTeam);

  const liveVolume = (homePm?.volume ?? 0) + (awayPm?.volume ?? 0);
  const liveLiquidity = Math.max(homePm?.liquidity ?? 0, awayPm?.liquidity ?? 0);
  const hasLive = homePm != null || awayPm != null;

  function openBet(pm: WcLiveMarket | null, side: "yes" | "no", label: string) {
    if (!pm?.key) {
      toast.info({
        title: "No live book for this market",
        description: `${side.toUpperCase()} on "${label}". No resting orders right now.`,
      });
      return;
    }
    setSheet({ market: pm, side });
  }

  const pct = (p: number) => `${Math.round(p * 100)}%`;

  return (
    <>
      {/* ── Dark stadium hero ── */}
      <section
        className="mhero"
        style={{ "--hc": hColor, "--ac": aColor } as React.CSSProperties}
        aria-label={`${match.homeTeam} versus ${match.awayTeam}`}
      >
        <div className="side l">
          <div className="glow" />
          {hCard && (
            <img className="cimg" src={`/brand/cards/${hCard}.jpg`} alt="" aria-hidden="true" />
          )}
        </div>
        <div className="side r">
          <div className="glow" />
          {aCard && (
            <img className="cimg" src={`/brand/cards/${aCard}.jpg`} alt="" aria-hidden="true" />
          )}
        </div>
        <div className="scrim" />
        <div className="vig" />
        <div className="wrap">
          <nav className="crumbs" aria-label="Breadcrumb">
            <Link href="/wc">Predict WC</Link>
            <span className="sep">/</span>
            <Link href="/wc/matches">Matches</Link>
            <span className="sep">/</span>
            <b>
              {match.homeTeam} vs {match.awayTeam}
            </b>
          </nav>

          <div className="mh-chips">
            {hasLive && <span className="live">● LIVE</span>}
            <span>#{match.matchNumber.toString().padStart(3, "0")}</span>
            <span>{match.group ? `Group ${match.group}` : match.stage}</span>
            {match.overUnderGoals && <span>O/U {match.overUnderGoals}</span>}
          </div>

          <div className="mh-teams">
            <div className="t">
              {hFlag && <img className="fl" src={hFlag} alt={match.homeTeam} />}
              <div className="nm">{match.homeTeam}</div>
              {match.moneylineHome && <div className="od h">{match.moneylineHome}</div>}
              <div className="wpb h">{pct(pHome)}</div>
            </div>
            <div className="mh-mid">
              <div className="cd">{match.date}</div>
              <div className="cdl">KICKOFF</div>
            </div>
            <div className="t">
              {aFlag && <img className="fl" src={aFlag} alt={match.awayTeam} />}
              <div className="nm">{match.awayTeam}</div>
              {match.moneylineAway && <div className="od a">{match.moneylineAway}</div>}
              <div className="wpb a">{pct(pAway)}</div>
            </div>
          </div>

          <div className="mh-prob">
            <div className="tribar">
              <i className="h" style={{ width: `${(pHome / barTotal) * 100}%` }} />
              <i className="d" style={{ width: `${(pDraw / barTotal) * 100}%` }} />
              <i className="a" style={{ width: `${(pAway / barTotal) * 100}%` }} />
            </div>
            <div className="lbls">
              <span>
                {match.homeTeam} {pct(pHome)}
              </span>
              <span>Draw {pct(pDraw)}</span>
              <span>
                {match.awayTeam} {pct(pAway)}
              </span>
            </div>
          </div>

          <div className="mh-venue">{match.venue}</div>

          <div className="mh-stats">
            <div className="s">
              <div className="sv">{liveVolume > 0 ? fmtVolume(liveVolume) : "—"}</div>
              <div className="sl">Live volume</div>
            </div>
            <div className="s">
              <div className="sv">{liveLiquidity > 0 ? fmtVolume(liveLiquidity) : "—"}</div>
              <div className="sl">Liquidity</div>
            </div>
            <div className="s">
              <div className="sv" style={{ color: hasLive ? "#34d399" : "#9fb0d8" }}>
                {hasLive ? "Open" : "Soon"}
              </div>
              <div className="sl">Markets</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Markets + rules ── */}
      <div className="wrap dx">
        <main className="dx-main">
          <section className="dcard">
            <div className="dh">
              <h3>Markets</h3>
              <span className="hint">tap YES / NO to open the ticket</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <MarketRow
                label={`${match.homeTeam} to win`}
                pm={homePm}
                onBet={(side) => openBet(homePm, side, `${match.homeTeam} to win`)}
              />
              <MarketRow
                label={`${match.awayTeam} to win`}
                pm={awayPm}
                onBet={(side) => openBet(awayPm, side, `${match.awayTeam} to win`)}
              />
            </div>
            {!hasLive && (
              <p style={{ margin: "14px 0 0", fontSize: 12.5, color: "var(--muted)" }}>
                No live book for this fixture yet. Win markets open once the book is seeded.
                Moneyline above is bookie reference only.
              </p>
            )}
          </section>

          <section className="dcard rules">
            <div className="dh">
              <h3>Rules</h3>
              <span className="hint">Resolution</span>
            </div>
            <p>
              Each market on this fixture resolves from the official result of {match.homeTeam}{" "}
              vs {match.awayTeam} (match #{match.matchNumber.toString().padStart(3, "0")},{" "}
              {match.venue}). &quot;{match.homeTeam} to win&quot; and &quot;{match.awayTeam} to
              win&quot; resolve YES only on a win in regulation. Resolution follows the official
              official result.
            </p>
            <div className="meta">
              <span>Resolution: onchain, official result</span>
              <span>Source: official result</span>
              <span>Regulation time only (90&apos; + stoppage)</span>
            </div>
          </section>
        </main>

        <aside className="dx-rail">
          <section className="dcard" style={{ padding: "16px 18px" }}>
            <div className="dh" style={{ marginBottom: 10 }}>
              <h3 style={{ fontSize: 15 }}>Trade this match</h3>
              <span className="hint">live book</span>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
              Pick a side above to open the order ticket. Orders fill on the live prediction market book and
              settle onchain. Real money, real fills. 18+ only.
            </p>
          </section>
        </aside>
      </div>

      {sheet && (
        <BetSheet market={sheet.market} initialSide={sheet.side} onClose={() => setSheet(null)} />
      )}
    </>
  );
}

function MarketRow({
  label,
  pm,
  onBet,
}: {
  label: string;
  pm: WcLiveMarket | null;
  onBet: (side: "yes" | "no") => void;
}) {
  const yes = pm?.yesPrice != null ? Math.round(pm.yesPrice * 100) : null;
  const no = yes != null ? 100 - yes : null;
  const live = pm?.key != null && yes != null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "12px 14px",
        border: "1px solid var(--line)",
        borderRadius: 12,
        background: "var(--bg-soft)",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14.5, color: "var(--ink)" }}>{label}</div>
        <div
          style={{
            fontFamily: "var(--f-tech)",
            fontSize: 11.5,
            color: live ? "var(--yes)" : "var(--muted-2)",
            marginTop: 2,
          }}
        >
          {live ? `${yes}¢ YES · ${fmtVolume(pm?.volume ?? 0)} vol` : "No live book"}
        </div>
      </div>
      <span className="ynx" style={{ flex: "0 0 168px" }}>
        <button
          type="button"
          className="y"
          onClick={() => onBet("yes")}
          aria-label={`YES: ${label}`}
        >
          YES
          <small>{yes != null ? `${yes}¢` : "—"}</small>
        </button>
        <button type="button" className="n" onClick={() => onBet("no")} aria-label={`NO: ${label}`}>
          NO
          <small>{no != null ? `${no}¢` : "—"}</small>
        </button>
      </span>
    </div>
  );
}
