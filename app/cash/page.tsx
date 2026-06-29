"use client";

// SellPanel reads useSearchParams (?vault= deep link); the page is interactive
// and wallet-bound, so render it dynamically rather than prerendering.
export const dynamic = "force-dynamic";

/**
 * /cash — Peer (zkP2P) fiat ⇄ USDC ramp.
 *
 * Gated by NEXT_PUBLIC_FEATURE_PEER=true.
 * Buy:  zkP2P on-ramp flow via BuyPanel (desktop Chrome + PeerAuth extension required).
 * Sell: real maker deposit flow — USDC escrowed on Base mainnet.
 */

import "./cash.css";
import { ActivityPanel } from "@/components/peer/ActivityPanel";
import { BuyPanel } from "@/components/peer/BuyPanel";
import { OrderbookPanel } from "@/components/peer/OrderbookPanel";
import { SellPanel } from "@/components/peer/SellPanel";
import { Nav } from "@/components/shared/Nav";
import { cn } from "@/lib/cn";
import { PEER_ENABLED } from "@/lib/peer/config";
import React from "react";
import { Suspense } from "react";

// ─── disabled state ───────────────────────────────────────────────────────────

function ComingSoon() {
  return (
    <div className="ds4" style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <Nav />

      {/* hero */}
      <section className="s-hero" style={{ minHeight: 440 }}>
        <img className="s-hero-bg" src="/brand/heroes/p2p.png" alt="" />
        <div className="wrap s-hero-inner" style={{ minHeight: 440 }}>
          <div className="s-hero-copy">
            <span className="eyebrow">
              <span className="tick" />
              Cash · on-ramp and off-ramp · P2P
            </span>
            <h1>
              Buy and sell stablecoins
              <br />
              <span className="blue">peer to peer.</span>
            </h1>
          </div>
        </div>
      </section>

      <div className="wrap" style={{ paddingTop: 64, paddingBottom: 80 }}>
        <div
          style={{
            maxWidth: 520,
            margin: "0 auto",
            border: "1px dashed var(--line-2)",
            borderRadius: "var(--r-xl)",
            padding: "56px 32px",
            textAlign: "center",
          }}
        >
          <span
            style={{
              fontFamily: "var(--f-tech)",
              fontSize: 11,
              letterSpacing: ".18em",
              textTransform: "uppercase",
              color: "var(--muted-2)",
            }}
          >
            Coming soon
          </span>
          <h2 style={{ fontSize: 22, marginTop: 12, marginBottom: 12 }}>
            The on / off-ramp launches soon
          </h2>
          <p
            style={{
              color: "var(--muted)",
              fontSize: 14,
              lineHeight: 1.65,
              maxWidth: 400,
              margin: "0 auto",
            }}
          >
            Buy stablecoins with fiat from your bank apps, or sell them directly into Wise, Revolut,
            Venmo, Zelle and more. Cash in and out in minutes.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── tabs ─────────────────────────────────────────────────────────────────────

type Tab = "buy" | "sell" | "book" | "activity";

const TABS: { id: Tab; label: string }[] = [
  { id: "buy", label: "BUY" },
  { id: "sell", label: "SELL" },
  { id: "book", label: "RATES" },
  { id: "activity", label: "ACTIVITY" },
];

function RampTabs({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <div className="ramp-h">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={cn("rtab", active === t.id && "on")}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ─── how it works ─────────────────────────────────────────────────────────────

function HowItWorks() {
  return (
    <section className="wrap" style={{ paddingBottom: 56 }}>
      <span className="eyebrow">
        <span className="tick" />
        How P2P settlement works
      </span>
      <div className="steps" style={{ marginTop: 22 }}>
        {[
          {
            n: "01 · ESCROW",
            title: "You lock stablecoins",
            body: "Deposit USDC into the P2P escrow and set your platform, currency, and rate.",
          },
          {
            n: "02 · INTENT",
            title: "A buyer takes your offer",
            body: "The buyer commits onchain to your deposit. Your escrow is reserved at your quoted rate.",
          },
          {
            n: "03 · PAY",
            title: "They pay you in fiat",
            body: "The buyer sends fiat to your Wise, Revolut or Venmo at exactly the quoted rate. Your USDC stays escrowed until proof.",
          },
          {
            n: "04 · PROVE",
            title: "Proof releases escrow",
            body: "A zkTLS proof verifies the bank transfer, and escrow releases the USDC to the buyer. You keep the fiat. About 2 minutes end to end.",
          },
        ].map((s) => (
          <div key={s.n} className="step">
            <span className="n">{s.n}</span>
            <b>{s.title}</b>
            <p>{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function CashPage() {
  if (!PEER_ENABLED) return <ComingSoon />;
  return (
    <Suspense fallback={null}>
      <CashPageInner />
    </Suspense>
  );
}

function CashPageInner() {
  const [tab, setTab] = React.useState<Tab>("buy");

  return (
    <div className="ds4" style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <Nav />

      {/* hero */}
      <section className="s-hero" style={{ minHeight: 440 }}>
        <img className="s-hero-bg" src="/brand/heroes/p2p.png" alt="" />
        <div className="wrap s-hero-inner" style={{ minHeight: 440 }}>
          <div className="s-hero-copy">
            <span className="eyebrow">
              <span className="tick" />
              Cash · on-ramp and off-ramp · non-custodial
            </span>
            <h1>
              Buy or sell stablecoins
              <br />
              <span className="blue">peer to peer.</span>
            </h1>
            <p className="lead" style={{ marginBottom: 0 }}>
              Fund your wallet with fiat, or off-ramp your stables straight into your account.
              Venmo, CashApp, Revolut, Wise and many more.
            </p>
          </div>
        </div>
      </section>

      {/* ramp widget — centered, wider on sell tab */}
      <section
        className="wrap"
        style={{
          paddingTop: 38,
          paddingBottom: 32,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div
          className="ramp"
          style={{
            width: "100%",
            maxWidth: tab === "sell" ? 1000 : 520,
            transition: "max-width .2s",
          }}
        >
          <RampTabs active={tab} onChange={setTab} />
          <div id="ramp-body" style={{ marginTop: 4 }}>
            {tab === "buy" && <BuyPanel />}
            {tab === "sell" && <SellPanel />}
            {tab === "book" && <OrderbookPanel />}
            {tab === "activity" && <ActivityPanel />}
          </div>
        </div>
      </section>

      {/* how it works */}
      <HowItWorks />
    </div>
  );
}
