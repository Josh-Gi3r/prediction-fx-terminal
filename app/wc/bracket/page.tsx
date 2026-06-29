import { Nav } from "@/components/shared/Nav";
import { BracketClient } from "@/components/wc/BracketClient";
import { WcSubnav } from "@/components/wc/WcSubnav";
import { KNOCKOUT_ODDS } from "@/lib/wc2026";

export const metadata = {
  title: "Predict WC · Bracket",
  description: "Knockout stage bracket with advance probabilities for the World Cup 2026.",
};

export default function BracketPage() {
  return (
    <>
      <Nav />
      <main className="ds4">
        {/* Mini section header */}
        <section className="wc-mini" aria-label="Knockout stage bracket">
          <img className="wc-mini-bg" src="/brand/bg/bracket.jpg" alt="" aria-hidden="true" />
          <div className="wrap">
            <span className="eyebrow">
              <span className="tick" />
              Knockout stage · Road to the final
            </span>
            <h1>
              The best teams left. <span className="blue">One lifts the trophy.</span>
            </h1>
            <p className="lead">
              Predict who advances through quarters, semis, and the final. Jul 11 – Jul 19.
            </p>
          </div>
        </section>

        <WcSubnav />

        <section className="section" style={{ paddingTop: 48 }} aria-label="Bracket standings">
          <div style={{ maxWidth: "var(--maxw)", margin: "0 auto", padding: "0 28px" }}>
            {/*
              BracketClient overlays PM champion / reach_round / advance_ko markets
              on the static KNOCKOUT_ODDS enrichment (toWin, toReachFinal, etc.).
              Static numbers are labeled "ref" when no PM market exists.
            */}
            <BracketClient knockoutOdds={KNOCKOUT_ODDS} />

            <p
              className="mono"
              style={{
                fontSize: 11.5,
                color: "var(--muted-2)",
                marginTop: 20,
              }}
            >
              Probabilities are live market-implied where a market exists ("ref" = bookie reference
              only; no live book). 18+ only.
            </p>
          </div>
        </section>
      </main>
    </>
  );
}
