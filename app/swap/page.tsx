"use client";

import { RatesCard } from "@/components/desks/RatesCard";
import { SwapCard } from "@/components/desks/SwapCard";
import { Nav } from "@/components/shared/Nav";
import { useSwapIntent } from "@/stores/swapIntent";
import Image from "next/image";

/**
 * Swap — the taker surface. Live quotes from four executable desks
 * (FX Provider, LiFi, KyberSwap, CoW) ranked side by side; user signs the winner.
 * Supersedes the old /router page (which now redirects here).
 */
export default function SwapPage() {
  const pending = useSwapIntent((s) => s.pending);
  const consume = useSwapIntent((s) => s.consume);
  const setPending = useSwapIntent((s) => s.setPending);

  return (
    <div className="ds4 min-h-screen" style={{ background: "var(--bg)" }}>
      <Nav />

      {/* Hero */}
      <section className="s-hero" data-page="swap">
        <Image
          src="/brand/heroes/swap.jpg"
          alt=""
          fill
          priority
          className="s-hero-bg"
          style={{ objectFit: "cover", objectPosition: "70% 50%" }}
        />
        <div className="wrap s-hero-inner">
          <div className="s-hero-copy">
            <span className="eyebrow">
              <span className="tick" />
              Swap FX · non-custodial
            </span>
            <h1>
              Swap stables
              <br />
              <span className="blue">at the best price.</span>
            </h1>
            <p className="lead">
              Every swap is priced on every onchain venue we route to, and you get the best one.
              <br />
              The number shown is the least you can receive. Often you get more.
            </p>
          </div>
        </div>
      </section>

      {/* Swap + desk comparison */}
      <SwapCard pending={pending} onConsumed={consume} />

      {/* FX Markets — live corridor rates, click a row to load it into the swap above */}
      <section className="section" data-screen-label="Swap / FX markets">
        <div className="wrap">
          <div style={{ marginBottom: 14 }}>
            <span className="eyebrow">
              <span className="dot-live" style={{ background: "var(--yes)" }} />
              FX markets · live across funded corridors
            </span>
            <h2 style={{ marginTop: 12 }}>Browse the market</h2>
            <p className="lead" style={{ marginTop: 8, maxWidth: 620 }}>
              Live rates scanned across every funded corridor, desk by desk. Tap any row to load
              that pair into the swap above.
            </p>
          </div>
          <RatesCard
            onSwapPair={(from, to) => {
              setPending({ from, to });
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        </div>
      </section>
    </div>
  );
}
