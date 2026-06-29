import { Nav } from "@/components/shared/Nav";
import { GroupsClient } from "@/components/wc/GroupsClient";
import { WcSubnav } from "@/components/wc/WcSubnav";
import { GROUPS, type GroupId, groupOddsByGroup } from "@/lib/wc2026";

export const metadata = {
  title: "Predict WC · Groups",
  description:
    "Group-stage win probabilities and advance odds for all 12 groups at the World Cup 2026.",
};

export default function GroupsPage() {
  const byGroup = groupOddsByGroup();

  return (
    <>
      <Nav />
      <main className="ds4">
        {/* Mini section header */}
        <section className="wc-mini" aria-label="Group stage">
          <img className="wc-mini-bg" src="/brand/bg/groups.jpg" alt="" aria-hidden="true" />
          <div className="wrap">
            <span className="eyebrow">
              <span className="tick" />
              Group stage · 12 groups
            </span>
            <h1>
              Who tops the group? <span className="blue">Who survives?</span>
            </h1>
            <p className="lead">
              Top two in each group advance. Predict who wins the group and who qualifies.
            </p>
          </div>
        </section>

        <WcSubnav />

        <section className="section" style={{ paddingTop: 48 }} aria-label="Group standings">
          <div style={{ maxWidth: "var(--maxw)", margin: "0 auto", padding: "0 28px" }}>
            {/*
              GroupsClient fetches PM group_winner markets (live) and passes them
              into each GroupCard. Static GROUP_ODDS provides the team list and
              bookie reference odds — never the source of tradeable prices.
            */}
            <GroupsClient groups={GROUPS} byGroup={byGroup} />
            <p
              className="mono"
              style={{
                fontSize: 11.5,
                color: "var(--muted-2)",
                marginTop: 20,
              }}
            >
              Win-group percentages are live market-implied probabilities where a market exists.
              "ref" = bookie reference only; no live PM book. 18+ only.
            </p>
          </div>
        </section>
      </main>
    </>
  );
}
