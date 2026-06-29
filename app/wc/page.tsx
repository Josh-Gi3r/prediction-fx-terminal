import { Nav } from "@/components/shared/Nav";
import { CountdownHero } from "@/components/wc/CountdownHero";
import { FeaturedFmd } from "@/components/wc/FeaturedFmd";
import { FeaturedMatchesSection } from "@/components/wc/FeaturedMatchesSection";
import { LiveOutrightSection } from "@/components/wc/LiveWcSections";
import { SpecialsPreview } from "@/components/wc/SpecialsGrid";
import { WcSubnav } from "@/components/wc/WcSubnav";
import { MATCHES, PLAYER_ODDS, parsePercent, topTeams } from "@/lib/wc2026";
import Link from "next/link";

export const metadata = {
  title: "Predict WC · Outright",
  description:
    "Outright winner, group, match, and novelty markets for the World Cup 2026. Live market odds.",
};

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

export default function WcOutrightPage() {
  const teams = topTeams();
  const maxPct = Math.max(...teams.map((t) => parsePercent(t.polymarketPct)));

  // Featured matches: first 3 group-stage fixtures (enrichment; live PM overlaid)
  const featured = MATCHES.slice(0, 3);

  // Top 5 golden boot players by kalshi implied — for reference teaser only
  const topBoot = [...PLAYER_ODDS]
    .sort((a, b) => parsePercent(b.kalshiImplied) - parsePercent(a.kalshiImplied))
    .slice(0, 5);

  const maxBootPct = Math.max(...topBoot.map((p) => parsePercent(p.kalshiImplied)), 1);

  return (
    <>
      <Nav />
      <main className="ds4">
        {/* Hero */}
        <CountdownHero />

        {/* Sub-nav */}
        <WcSubnav />

        {/* ===================== MATCHES (dark) — wc.html .matches ===================== */}
        <section className="matches" id="matches">
          <div className="wrap">
            <div className="mhead">
              <div>
                <h2>Featured &amp; upcoming</h2>
                <p className="msub">
                  The marquee tie plus a few to watch. Full schedule on the Matches tab.
                </p>
              </div>
              <Link href="/wc/matches" className="btn wc-seeall" aria-label="See all 104 matches">
                See all 104 matches
                <ArrowIcon />
              </Link>
            </div>

            {/* Featured match panel + Golden Boot mini — live PM data */}
            <FeaturedFmd />

            {/* Featured match cards — live PM overlay via client component */}
            <FeaturedMatchesSection matches={featured} />

            <p className="disc-d">
              <svg width="15" height="15" viewBox="0 0 15 15" aria-hidden="true">
                <circle cx="7.5" cy="7.5" r="6.5" stroke="#7f90b0" strokeWidth="1.2" fill="none" />
                <path
                  d="M7.5 6.6v4M7.5 4.6v.1"
                  stroke="#7f90b0"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              Win probabilities: live market-implied where a market exists, bookie reference
              otherwise (&quot;ref&quot;). Not financial advice. 18+ only.
            </p>
          </div>
        </section>

        {/* ===================== SPECIALS preview — wc.html #tops ===================== */}
        <section className="section" style={{ paddingBottom: 0 }}>
          <div className="wrap">
            <div className="between" style={{ marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
              <div>
                <h2 style={{ fontSize: "clamp(24px,3vw,34px)" }}>Specials</h2>
                <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 13.5 }}>
                  Will Ronaldo cry? Keeper scores? The fun book, live.
                </p>
              </div>
              <Link className="btn btn-ghost" href="/wc/props">
                All specials
                <ArrowIcon />
              </Link>
            </div>
            <SpecialsPreview limit={8} />
          </div>
        </section>

        {/* ===================== OUTRIGHT (light) — wc.html .ot ===================== */}
        <LiveOutrightSection teams={teams} maxPct={maxPct} />

        {/* Golden Boot teaser — Kalshi/static reference only, labeled as such */}
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <div className="gboot">
              <div className="gboot-head">
                <div>
                  <h3 style={{ margin: 0 }}>Golden Boot · top scorers</h3>
                  <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 13.5 }}>
                    Predict who finishes as the tournament&apos;s top scorer.
                  </p>
                </div>
                <Link href="/wc/boot" className="btn btn-ghost btn-sm">
                  Full market
                  <ArrowIcon />
                </Link>
              </div>
              <div className="gboot-list">
                {topBoot.map((p, i) => {
                  const pct = parsePercent(p.kalshiImplied);
                  const barW = maxBootPct > 0 ? (pct / maxBootPct) * 100 : 0;
                  return (
                    <div key={`${p.player}-${p.nation}`} className="gb">
                      <span className="rk">{i + 1}</span>
                      <span className="pl">
                        {p.player}
                        <em>{p.nation}</em>
                      </span>
                      <span className="bar">
                        <i style={{ width: `${barW}%` }} />
                      </span>
                      <span className="od">{p.draftkings ?? p.kalshiImplied ?? "—"}</span>
                    </div>
                  );
                })}
              </div>
              <p
                style={{
                  margin: "10px 0 0",
                  fontSize: 11,
                  color: "var(--muted-2)",
                  lineHeight: 1.5,
                }}
              >
                Preview odds are bookie reference. Live markets on the{" "}
                <Link href="/wc/boot" style={{ color: "var(--brand)" }}>
                  full Golden Boot page
                </Link>
                .
              </p>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
