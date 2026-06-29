import { Nav } from "@/components/shared/Nav";
import { WcSubnav } from "@/components/wc/WcSubnav";
import { MATCHES } from "@/lib/wc2026";
import { MatchesClient } from "./MatchesClient";

export const metadata = {
  title: "Predict WC · Matches",
  description: "All 104 World Cup 2026 match fixtures with odds and market data.",
};

/** Unique ordered dates from the first 15 group-stage fixtures (matches page scope). */
function uniqueDates(matches: typeof MATCHES): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of matches) {
    if (!seen.has(m.date)) {
      seen.add(m.date);
      out.push(m.date);
    }
  }
  return out.slice(0, 6);
}

export default function MatchesPage() {
  // Show group-stage MD1 matches (first 15)
  const groupMatches = MATCHES.filter((m) => m.stage === "Group Stage MD1");
  const allGroupMatches = MATCHES.filter(
    (m) =>
      m.stage === "Group Stage MD1" ||
      m.stage === "Group Stage MD2" ||
      m.stage === "Group Stage MD3",
  );
  const dates = uniqueDates(allGroupMatches);

  return (
    <>
      <Nav />
      <main className="ds4">
        {/* Mini section header */}
        <section className="wc-mini" aria-label="Match schedule">
          <img className="wc-mini-bg" src="/brand/bg/matches.jpg" alt="" aria-hidden="true" />
          <div className="wrap">
            <span className="eyebrow">
              <span className="dot-live" aria-hidden="true" />
              Match schedule · 104 fixtures
            </span>
            <h1>
              All 104 matches. <span className="blue">Every one tradeable.</span>
            </h1>
            <p className="lead">
              One market per question: match winner, draw, over/under and more. Settled onchain.
            </p>
          </div>
        </section>

        <WcSubnav />

        <section className="wc-matches-dark" aria-label="Match grid">
          <div className="wrap">
            <MatchesClient matches={groupMatches} dates={dates} />
          </div>
        </section>
      </main>
    </>
  );
}
