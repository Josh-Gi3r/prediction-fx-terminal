import { Nav } from "@/components/shared/Nav";
import { WcSubnav } from "@/components/wc/WcSubnav";
import { PLAYER_ODDS } from "@/lib/wc2026";
import { BootClient } from "./BootClient";

export const metadata = {
  title: "Predict WC · Golden Boot",
  description:
    "Predict who wins the World Cup 2026 Golden Boot. Top scorer market with live odds.",
};

export default function BootPage() {
  return (
    <>
      <Nav />
      <main className="ds4">
        {/* Mini section header */}
        <section className="wc-mini" aria-label="Golden Boot market">
          <img className="wc-mini-bg" src="/brand/bg/boot.jpg" alt="" aria-hidden="true" />
          <div className="wrap">
            <span className="eyebrow">
              <span className="tick" />
              Golden Boot · top scorer market
            </span>
            <h1>
              Who finishes <span className="blue">top scorer?</span>
            </h1>
            <p className="lead">
              Predict YES / NO on every contender. Resolves on the official final tally at the official host organization
              World Cup 2026.
            </p>
          </div>
        </section>

        <WcSubnav />

        <section
          className="section"
          style={{ paddingTop: 48 }}
          aria-label="Golden Boot leaderboard"
        >
          <div style={{ maxWidth: "var(--maxw)", margin: "0 auto", padding: "0 28px" }}>
            <div
              style={{
                marginBottom: 18,
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
                alignItems: "baseline",
                justifyContent: "space-between",
              }}
            >
              <h2 style={{ fontSize: "clamp(24px,3vw,34px)" }}>Golden Boot · live markets</h2>
              <span className="chip">
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: "var(--yes)",
                    animation: "pulse 1.8s infinite",
                    display: "inline-block",
                    marginRight: 6,
                  }}
                />
                LIVE · rows = gate-passing markets only
              </span>
            </div>

            {/*
              Rows are driven exclusively by the live golden-boot market registry.
              Static PLAYER_ODDS is passed as enrichment only (club, nation, bookie odds).
              Players with no live PM market do not appear as tradeable rows.
            */}
            <BootClient players={PLAYER_ODDS} />

            <p
              className="mono"
              style={{
                fontSize: 11.5,
                color: "var(--muted-2)",
                marginTop: 18,
              }}
            >
              Rows are live golden-boot markets that passed the liquidity gate. DraftKings odds
              shown as reference enrichment only. Live market prices are the source of truth. 18+
              only.
            </p>
          </div>
        </section>
      </main>
    </>
  );
}
