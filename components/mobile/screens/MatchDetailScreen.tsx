"use client";

import { normalizePmTeamName } from "@/lib/wc2026/teamAlias";
import { type WcLiveMarket, fmtVolume, useWcMarkets } from "@/lib/wc2026/usePm";
import { useMemo } from "react";
import type { SlipMarket } from "../BetSlip";
import { Icon } from "../Icon";
import { type WcMatch, matchMarkets } from "../data";
import { Disclaimer, Flag, cardSrc, codeOf } from "../primitives";

interface MatchDetailScreenProps {
  m: WcMatch;
  onBack: () => void;
  openSlip: (s: SlipMarket) => void;
}

const MONTHS: Record<string, string> = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dec: "12",
};

/** "Jun 11" -> "2026-06-11" (PM match questions key by ISO date). */
function matchIsoDate(date: string): string | null {
  const mt = date.match(/^([A-Za-z]{3})\s+(\d{1,2})/);
  if (!mt) return null;
  const mm = MONTHS[(mt[1] ?? "").toLowerCase()];
  if (!mm) return null;
  return `2026-${mm}-${(mt[2] ?? "").padStart(2, "0")}`;
}

export function MatchDetailScreen({ m, onBack, openSlip }: MatchDetailScreenProps) {
  const staticMarkets = matchMarkets(m);

  // Live PM match markets for THIS match: home/away win found by normalized
  // teamName + ISO date in the question; draw found as the event sibling.
  const { data } = useWcMarkets({ category: "match" });
  const live = useMemo(() => {
    const ms = data?.markets ?? [];
    const iso = matchIsoDate(m.date);
    const home = normalizePmTeamName(m.h);
    const away = normalizePmTeamName(m.a);
    const find = (team: string | null) =>
      ms.find((k) => k.teamName === team && (iso ? k.question.includes(iso) : false)) ?? null;
    const homeWin = find(home);
    const awayWin = find(away);
    const slug = homeWin?.eventSlug ?? awayWin?.eventSlug ?? null;
    const draw = slug
      ? (ms.find((k) => k.eventSlug === slug && /draw/i.test(k.question)) ?? null)
      : null;
    const all = [homeWin, awayWin, draw].filter(Boolean) as WcLiveMarket[];
    const volume = all.reduce((sum, k) => sum + (k.volume ?? 0), 0);
    return { homeWin, awayWin, draw, count: all.length, volume };
  }, [data, m.h, m.a, m.date]);

  const pct = (k: WcLiveMarket | null) =>
    k?.yesPrice != null ? Math.round(k.yesPrice * 100) : null;
  const hc3 = m.hc3 ?? codeOf(m.ho ?? "");
  const ac3 = m.ac3 ?? codeOf(m.ao ?? "");
  const hl = cardSrc(m.h);
  const al = cardSrc(m.a);

  return (
    <div className="screen dark fade-in">
      <div className="md-hero" style={{ "--hc": m.hc, "--ac": m.ac } as React.CSSProperties}>
        <div className="side l">
          <div className="glow" />
        </div>
        <div className="side r">
          <div className="glow" />
        </div>
        {hl && <img className="cimg l" src={hl} alt="" />}
        {al && <img className="cimg r" src={al} alt="" />}
        <div className="scrim" />
        <div className="mdbody">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <button type="button" className="iconbtn dark" onClick={onBack} aria-label="Back">
              <Icon name="back" size={20} color="#fff" />
            </button>
            <span className="badge-live">
              <span className="dot-live" />
              {m.round}
            </span>
            <button type="button" className="iconbtn dark" aria-label="Favourite">
              <Icon name="star" size={19} color="#fff" />
            </button>
          </div>
          <div className="mdteams">
            <div>
              <Flag code={hc3} size={44} />
              <div className="nm" style={{ marginTop: 8 }}>
                {m.h}
              </div>
            </div>
            <div>
              <div className="cd">{m.cd ?? m.time ?? m.date}</div>
              <div className="cdl">{m.cd ? "STARTS IN" : "KICKOFF"}</div>
            </div>
            <div>
              <Flag code={ac3} size={44} />
              <div className="nm" style={{ marginTop: 8 }}>
                {m.a}
              </div>
            </div>
          </div>
          <div className="md-venue">
            <Icon name="pin" size={13} color="#cdd8f2" /> {m.venue}
          </div>
        </div>
      </div>

      <div className="hscroll" style={{ marginTop: 16 }}>
        {[
          [live.volume > 0 ? fmtVolume(live.volume) : "—", "Volume · live"],
          [live.count > 0 ? String(live.count) : "—", "Live markets"],
          [pct(live.homeWin) != null ? `${pct(live.homeWin)}%` : (m.ho ?? "—"), `${m.h} win`],
          [pct(live.draw) != null ? `${pct(live.draw)}%` : (m.dr ?? "—"), "Draw"],
          [pct(live.awayWin) != null ? `${pct(live.awayWin)}%` : (m.ao ?? "—"), `${m.a} win`],
        ].map(([v, l], i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: static design-data list
            key={i}
            style={{
              flex: "0 0 auto",
              minWidth: 96,
              background: "rgba(255,255,255,.05)",
              border: "1px solid rgba(255,255,255,.12)",
              borderRadius: 14,
              padding: "11px 14px",
            }}
          >
            <div
              style={{
                fontFamily: "var(--f-display)",
                fontWeight: 800,
                fontSize: 16,
                color: i === 2 ? "#34d399" : "#fff",
                whiteSpace: "nowrap",
              }}
            >
              {v}
            </div>
            <div
              style={{
                fontFamily: "var(--f-tech)",
                fontSize: 9.5,
                letterSpacing: ".06em",
                textTransform: "uppercase" as const,
                color: "#8595bd",
                marginTop: 2,
                whiteSpace: "nowrap",
              }}
            >
              {l}
            </div>
          </div>
        ))}
      </div>

      <div className="sec-head ondark">
        <h2>Markets</h2>
        <span style={{ fontFamily: "var(--f-tech)", fontSize: 12, color: "#8595bd" }}>
          {live.count > 0 ? `${live.count} live` : `${staticMarkets.length} ref`}
        </span>
      </div>

      <div style={{ paddingTop: 2 }}>
        {/* Live PM markets -- real prices + real bet execution via BetSlip */}
        {(
          [
            { k: live.homeWin, q: `${m.h} to win`, yesL: "YES" },
            { k: live.draw, q: "Draw", yesL: "YES" },
            { k: live.awayWin, q: `${m.a} to win`, yesL: "YES" },
          ] as Array<{ k: WcLiveMarket | null; q: string; yesL: string }>
        )
          .filter((r) => r.k)
          .map((r) => {
            const k = r.k as WcLiveMarket;
            const yes = Math.round((k.yesPrice ?? 0.5) * 100);
            return (
              <div className="market-card" key={k.key}>
                <div className="mq">{r.q}</div>
                <div className="msub">
                  {k.question} · {fmtVolume(k.volume)} vol · live
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <span
                    style={{
                      fontFamily: "var(--f-tech)",
                      fontWeight: 700,
                      fontSize: 13,
                      color: "var(--yes)",
                      width: 34,
                    }}
                  >
                    {yes}%
                  </span>
                  <div className="probar" style={{ flex: 1 }}>
                    <span className="yespart" style={{ width: `${yes}%` }} />
                  </div>
                  <span
                    style={{
                      fontFamily: "var(--f-tech)",
                      fontWeight: 700,
                      fontSize: 13,
                      color: "var(--no)",
                      width: 34,
                      textAlign: "right",
                    }}
                  >
                    {100 - yes}%
                  </span>
                </div>
                <div className="yn">
                  <button
                    type="button"
                    className="yes"
                    onClick={() =>
                      openSlip({
                        q: k.question,
                        tag: `${m.h} vs ${m.a}`,
                        yesL: "YES",
                        noL: "NO",
                        yes,
                        no: 100 - yes,
                        live: k,
                      })
                    }
                  >
                    YES<small>{Math.max(1, yes)}¢</small>
                  </button>
                  <button
                    type="button"
                    className="no"
                    onClick={() =>
                      openSlip({
                        q: k.question,
                        tag: `${m.h} vs ${m.a}`,
                        yesL: "YES",
                        noL: "NO",
                        yes,
                        no: 100 - yes,
                        pick: "no",
                        live: k,
                      })
                    }
                  >
                    NO<small>{Math.min(99, 100 - yes)}¢</small>
                  </button>
                </div>
              </div>
            );
          })}

        {/* Static reference rows -- no live market wired, show honest gate */}
        {live.count === 0 &&
          staticMarkets.map((mk, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static design-data list
            <div className="market-card" key={i}>
              <div className="mq">{mk.q}</div>
              <div className="msub">{mk.sub}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <span
                  style={{
                    fontFamily: "var(--f-tech)",
                    fontWeight: 700,
                    fontSize: 13,
                    color: "var(--yes)",
                    width: 34,
                  }}
                >
                  {mk.yes}%
                </span>
                <div className="probar" style={{ flex: 1 }}>
                  <span className="yespart" style={{ width: `${mk.yes}%` }} />
                </div>
                <span
                  style={{
                    fontFamily: "var(--f-tech)",
                    fontWeight: 700,
                    fontSize: 13,
                    color: "var(--no)",
                    width: 34,
                    textAlign: "right",
                  }}
                >
                  {mk.no}%
                </span>
              </div>
              {/* No live market: show honest gate, not a dead-end BetSlip */}
              <div
                style={{
                  fontFamily: "var(--f-tech)",
                  fontSize: 11,
                  color: "#7889b3",
                  textAlign: "center",
                  padding: "8px 0 4px",
                }}
              >
                not yet tradeable · bookie reference only
              </div>
            </div>
          ))}
      </div>

      <Disclaimer dark />
    </div>
  );
}
