"use client";

import { PredictFxPopup } from "@/components/shared/PredictFxPopup";
import { usePrivy } from "@privy-io/react-auth";
import { useState } from "react";
import type { SlipMarket } from "../BetSlip";
import { Icon } from "../Icon";
import { COR, LEV, TRADE_CATS, sparkPath } from "../data";
import { Disclaimer } from "../primitives";

function Spark({ seed, up }: { seed: number; up: boolean }) {
  const W = 300;
  const H = 42;
  const d = sparkPath(seed, up, W, H);
  const col = up ? "#13b981" : "#f0436a";
  const fill = up ? "rgba(19,185,129,.12)" : "rgba(240,67,106,.12)";
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      width="100%"
      height={H}
      style={{ display: "block" }}
      aria-hidden="true"
    >
      <path d={`${d} L${W} ${H} L0 ${H} Z`} fill={fill} />
      <path
        d={d}
        fill="none"
        stroke={col}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function heatStyle(chg: number): React.CSSProperties {
  const m = Math.max(-0.8, Math.min(0.8, chg)) / 0.8;
  if (m >= 0) {
    const a = 0.12 + 0.5 * m;
    return {
      background: `rgba(19,185,129,${a})`,
      color: "#0a5e43",
      borderColor: `rgba(19,185,129,${a + 0.1})`,
    };
  }
  const a = 0.12 + 0.5 * -m;
  return {
    background: `rgba(240,67,106,${a})`,
    color: "#8a1733",
    borderColor: `rgba(240,67,106,${a + 0.1})`,
  };
}

interface WaitlistSheetProps {
  product: string;
  prefillEmail: string;
  onDone: (msg: string) => void;
  onClose: () => void;
}

function WaitlistSheet({ product, prefillEmail, onDone, onClose }: WaitlistSheetProps) {
  const [email, setEmail] = useState(prefillEmail);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setErr("Enter a valid email address.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: trimmed, product }),
      });
      if (res.ok) {
        onDone("You're on the list. We'll notify you at launch.");
      } else {
        setErr("Something went wrong. Try again.");
      }
    } catch {
      setErr("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        background: "rgba(10,14,26,.6)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "flex-end",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "100%",
          background: "var(--surface)",
          borderRadius: "20px 20px 0 0",
          padding: "24px 20px 32px",
          boxShadow: "0 -8px 40px rgba(0,0,0,.35)",
        }}
      >
        <div
          style={{
            fontFamily: "var(--f-display)",
            fontWeight: 800,
            fontSize: 18,
            marginBottom: 6,
          }}
        >
          Notify me at launch
        </div>
        <div
          style={{
            fontSize: 13,
            color: "var(--muted)",
            marginBottom: 18,
          }}
        >
          {product}
        </div>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "13px 14px",
            borderRadius: 12,
            border: "1.5px solid var(--line)",
            background: "var(--surface-2)",
            fontSize: 15,
            fontFamily: "var(--f-ui)",
            color: "var(--ink)",
            marginBottom: err ? 6 : 14,
            outline: "none",
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
        />
        {err && <div style={{ fontSize: 12, color: "var(--down)", marginBottom: 10 }}>{err}</div>}
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          style={{
            width: "100%",
            padding: "15px",
            borderRadius: 13,
            border: "none",
            background: "var(--grad-brand)",
            color: "#fff",
            fontFamily: "var(--f-ui)",
            fontWeight: 700,
            fontSize: 15,
            cursor: busy ? "default" : "pointer",
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? "Saving..." : "Notify me"}
        </button>
      </div>
    </div>
  );
}

interface TradeScreenProps {
  onToast: (msg: string) => void;
  openSlip: (m: SlipMarket) => void;
}

export function TradeScreen({ onToast, openSlip: _openSlip }: TradeScreenProps) {
  const [inst, setInst] = useState<"deliverable" | "perp">("deliverable");
  const [cat, setCat] = useState("all");
  const [waitlistProduct, setWaitlistProduct] = useState<string | null>(null);

  const { user } = usePrivy();
  const privyEmail = user?.email?.address ?? "";

  const list = cat === "all" ? COR : COR.filter((c) => c.cat === cat);

  function openWaitlist(product: string) {
    setWaitlistProduct(product);
  }

  function closeWaitlist() {
    setWaitlistProduct(null);
  }

  function handleWaitlistDone(msg: string) {
    setWaitlistProduct(null);
    onToast(msg);
  }

  return (
    <div className="screen">
      <PredictFxPopup />
      {waitlistProduct && (
        <WaitlistSheet
          product={waitlistProduct}
          prefillEmail={privyEmail}
          onDone={handleWaitlistDone}
          onClose={closeWaitlist}
        />
      )}
      <div className="appbar">
        <div className="ab-title">Predict FX</div>
      </div>

      <div className="tiles" style={{ marginBottom: 4 }}>
        <div
          className="tile"
          style={
            inst === "deliverable"
              ? { borderColor: "var(--brand)", boxShadow: "0 0 0 2px var(--brand-3)" }
              : {}
          }
          onClick={() => setInst("deliverable")}
        >
          <div
            className="ti"
            style={inst === "deliverable" ? { background: "var(--grad-brand)", color: "#fff" } : {}}
          >
            <Icon name="forward" size={20} />
          </div>
          <h3>Deliverable forwards</h3>
          <p>Lock the rate, get the currency. No liquidations.</p>
        </div>
        <div
          className="tile"
          style={
            inst === "perp"
              ? { borderColor: "var(--brand)", boxShadow: "0 0 0 2px var(--brand-3)" }
              : {}
          }
          onClick={() => setInst("perp")}
        >
          <div
            className="ti"
            style={inst === "perp" ? { background: "var(--grad-brand)", color: "#fff" } : {}}
          >
            <Icon name="trade" size={20} />
          </div>
          <h3>FX Perps</h3>
          <p>Long or short pairs, up to 100x leverage.</p>
        </div>
      </div>

      {/* Both Predict-FX instruments are pre-launch — honest waitlist, no fake fills. */}
      <div
        style={{
          margin: "4px 18px 0",
          borderRadius: 10,
          border: "1px solid rgba(234,179,8,.3)",
          background: "rgba(234,179,8,.08)",
          padding: "9px 12px",
          textAlign: "center",
          fontSize: 12,
          color: "#92400e",
        }}
      >
        {inst === "perp" ? "FX perps" : "Deliverable forwards"} launch soon. Join the waitlist.
      </div>

      <div className="sec-head onlight">
        <h2>Corridor heat · 24h</h2>
      </div>
      <div className="heatleg">
        <span>Weak</span>
        <span className="g" />
        <span>Strong</span>
      </div>
      <div className="heatgrid">
        {COR.map((c, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static design-data list
          <div className="heat" key={i} style={heatStyle(c.chg)}>
            <span className="c">{c.ccy}</span>
            <span className="rt">{c.price}</span>
            <span className="p">
              {c.chg >= 0 ? "+" : ""}
              {c.chg.toFixed(2)}%
            </span>
          </div>
        ))}
      </div>

      <div className="sec-head onlight">
        <h2>{inst === "perp" ? "FX Perp corridors" : "Deliverable corridors"}</h2>
      </div>
      <div className="chiprow" style={{ marginBottom: 12 }}>
        {TRADE_CATS.map((f) => (
          <button
            type="button"
            key={f}
            className={`chip${cat === f ? " on" : ""}`}
            onClick={() => setCat(f)}
          >
            {f === "all" ? "All" : f}
          </button>
        ))}
      </div>

      {list.map((c, i) => {
        const up = c.chg >= 0;
        const lev = LEV[c.cat] ?? 20;
        const fund = (c.chg / 8).toFixed(3);
        return (
          <div className="tcard" key={c.ccy}>
            <div className="tctop">
              <span className="pair">
                <span className="pip" />
                {c.pair}
              </span>
              <span className={`tbadge${inst === "perp" ? " perp" : ""}`}>
                {inst === "perp" ? `Perp · ${lev}×` : "Deliverable"}
              </span>
            </div>
            <div className="tccy">{c.name}</div>
            <Spark seed={i + 3} up={up} />
            <div className="prow">
              <span className="price">{c.price}</span>
              <span
                className={up ? "up" : "down"}
                style={{ fontFamily: "var(--f-tech)", fontWeight: 700 }}
              >
                {up ? "+" : ""}
                {c.chg.toFixed(2)}%
              </span>
            </div>
            {inst === "perp" ? (
              <>
                <div className="tq">
                  Funding{" "}
                  <strong
                    style={{ color: Number.parseFloat(fund) >= 0 ? "var(--up)" : "var(--down)" }}
                  >
                    {Number.parseFloat(fund) >= 0 ? "+" : ""}
                    {fund}%/h
                  </strong>{" "}
                  · Cash-settled USDC · up to {lev}x
                </div>
                <div className="yn">
                  <button
                    type="button"
                    className="yes"
                    onClick={() => openWaitlist(`FX Perps · ${c.pair} · ${lev}x LONG`)}
                  >
                    Notify me<small>{lev}x LONG</small>
                  </button>
                  <button
                    type="button"
                    className="no"
                    onClick={() => openWaitlist(`FX Perps · ${c.pair} · ${lev}x SHORT`)}
                  >
                    Notify me<small>{lev}x SHORT</small>
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="tq">Will {c.q} on settlement?</div>
                <div className="yn">
                  <button
                    type="button"
                    className="yes"
                    onClick={() => openWaitlist(`Deliverable Forwards · ${c.pair} · YES`)}
                  >
                    Notify me<small>YES {c.yes}c</small>
                  </button>
                  <button
                    type="button"
                    className="no"
                    onClick={() => openWaitlist(`Deliverable Forwards · ${c.pair} · NO`)}
                  >
                    Notify me<small>NO {100 - c.yes}c</small>
                  </button>
                </div>
              </>
            )}
          </div>
        );
      })}

      <Disclaimer />
    </div>
  );
}
