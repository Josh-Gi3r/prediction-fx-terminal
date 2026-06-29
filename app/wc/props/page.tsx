import { Nav } from "@/components/shared/Nav";
import { SpecialsGrid } from "@/components/wc/SpecialsGrid";
import { WcSubnav } from "@/components/wc/WcSubnav";

export const metadata = {
  title: "Predict WC · Specials",
  description:
    "Novelty markets on the moments everyone argues about. Will Ronaldo cry? Hat trick? Keeper scores? Live YES prices, real books only.",
};

export default function SpecialsPage() {
  return (
    <>
      <Nav />
      <main className="ds4">
        {/* Mini hero — matches wc-specials.html section.wc-mini */}
        <section className="wc-mini" aria-label="Specials markets">
          <img className="wc-mini-bg" src="/brand/bg/matches.jpg" alt="" aria-hidden="true" />
          <div className="wrap">
            <span className="eyebrow">
              <span className="dot-live" style={{ background: "var(--no)" }} />
              Specials · the fun book
            </span>
            <h1>
              Will Ronaldo cry? <span className="blue">Trade it.</span>
            </h1>
            <p className="lead">
              Novelty markets on the moments everyone argues about. Live YES prices from real books.
              Nothing faked. Tap a card for the full market.
            </p>
          </div>
        </section>

        <WcSubnav />

        <SpecialsGrid />
      </main>
    </>
  );
}
