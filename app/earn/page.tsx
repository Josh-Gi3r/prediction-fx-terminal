"use client";

import { EarnCard } from "@/components/desks/EarnCard";
import { VaultsSection } from "@/components/peer/VaultsSection";
import { Nav } from "@/components/shared/Nav";
import { PEER_ENABLED } from "@/lib/peer/config";
import { Banknote } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

/**
 * Earn — real yield surfaces:
 *  - Aave v3 supply (live on-chain APY, in-app deposit/withdraw)
 *  - Pendle PT fixed yield (live markets, click-through)
 *  - Hyperliquid HLP + GMX GM perp LP (live APY, click-through)
 *  - DeFiLlama stablecoin yield explorer (SDYS-scored)
 *  - Virtual Liquidity (FX Provider) (provide one budget across many FX pairs)
 *  - Peer (zkP2P) maker liquidity — earn the fiat⇄USDC spread (via /cash)
 *
 * Replaces the former placeholder page whose strategies/stats were illustrative.
 */
export default function EarnPage() {
  return (
    <div className="ds4 min-h-screen" style={{ background: "var(--bg)" }}>
      <Nav />

      {/* Hero */}
      <section className="s-hero" data-page="earn">
        <Image
          src="/brand/heroes/earn.jpg"
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
              Earn · non-custodial
            </span>
            <h1>
              Put stablecoins
              <br />
              <span className="blue">to work, onchain.</span>
            </h1>
            <p className="lead">
              Earn real yield on your stablecoins. Lend, lock fixed rates, or provide liquidity and
              collect the fees. Every option is scored so you can see the risk before you commit.
              Your money stays in your wallet until you sign.
            </p>
          </div>
        </div>
      </section>

      {/* Content — EarnCard first, then FX vaults below */}
      <div className="wrap" style={{ paddingTop: 34, paddingBottom: 60 }}>
        {PEER_ENABLED && (
          <Link
            href="/cash"
            className="mb-6 flex items-start gap-3 rounded-2xl border p-4 transition"
            style={{
              borderColor: "var(--line)",
              background: "var(--bg-tint)",
              boxShadow: "var(--sh-1)",
            }}
          >
            <Banknote
              className="mt-0.5 size-4 shrink-0"
              style={{ color: "var(--accent)" }}
              aria-hidden="true"
            />
            <span>
              <span
                className="block text-sm font-semibold"
                style={{ color: "var(--ink)", fontFamily: "var(--f-ui)" }}
              >
                P2P maker liquidity: earn the fiat spread
              </span>
              <span
                className="mt-0.5 block text-xs leading-relaxed"
                style={{ color: "var(--muted)" }}
              >
                Escrow USDC on the P2P ramp and quote your own fiat⇄USDC rate. Buyers pay on
                Wise, Revolut, or Venmo; the protocol releases your USDC on proof. You set the
                spread. Top makers run 0.7–3.8% realized margins. Self-custodied escrow, set up
                under Cash → Sell.
              </span>
            </span>
          </Link>
        )}

        {/* Primary earn strategies */}
        <EarnCard />

        {/* FX vaults below EarnCard — clickable rows → detail pages */}
        {PEER_ENABLED && <VaultsSection />}
      </div>
    </div>
  );
}
