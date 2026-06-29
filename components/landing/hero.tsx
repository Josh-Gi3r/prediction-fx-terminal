import Image from "next/image";
import Link from "next/link";

const STATS = [
  { label: "Corridors", value: "12", sub: "live" },
  { label: "Settlement", value: "<1s", sub: "onchain" },
  { label: "Margin ccy", value: "Any", sub: "stablecoin" },
  { label: "Max leverage", value: "100×", sub: "majors" },
] as const;

/**
 * Hero — transplanted from design-v2 index.html.
 * One full-bleed baked image (.s-hero-bg) with the design's white-gradient wash
 * (.s-hero::after, from design.css); headline sits in .hero-copy over the wash.
 * Server component — no client JS.
 */
export function Hero() {
  return (
    <section className="s-hero" data-screen-label="Home / Hero">
      {/* ONE full-bleed hero image; left ~40% fades to white for the headline. */}
      <Image
        className="s-hero-bg"
        src="/brand/heroes/home.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
      />
      <div className="wrap s-hero-inner">
        <div className="hero-copy">
          <span className="eyebrow">
            <span className="tick" />
            Self-custodial · settled onchain
          </span>
          <h1>
            Stablecoin&nbsp;FX,
            <br />
            <span className="blue">settled onchain.</span>
          </h1>
          <p className="lead">
            Trade forwards, perps, and prediction markets on emerging-market currencies.
            <br />
            Settle in the stablecoin you choose, onchain, in under a second.
          </p>
          <div className="hero-cta">
            <Link className="btn btn-primary" href="/trade">
              Start trading
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
            <Link className="btn btn-ghost" href="/wc">
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                <circle cx="8" cy="8" r="6.3" stroke="currentColor" strokeWidth="1.4" fill="none" />
                <path
                  d="M2 8h12M8 2c2 2 2 10 0 12M8 2c-2 2-2 10 0 12"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  fill="none"
                />
              </svg>
              World Cup 2026 markets
            </Link>
          </div>
          <div className="statstrip">
            {STATS.map((s) => (
              <div className="s" key={s.label}>
                <div className="sl">{s.label}</div>
                <div className="sv">{s.value}</div>
                <div className="su">{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
