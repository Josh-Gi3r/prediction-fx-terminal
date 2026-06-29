"use client";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { type Corridor, realisticYesProb } from "@/lib/corridors/registry";
import { useFxRate, useTokenBySymbol } from "@/lib/fx-provider/hooks";
import { buildOrderAmounts, placeLimitOrder } from "@/lib/fx-provider/orders";
import { type OrderErrorCode, FxApiError } from "@/lib/fx-provider/types";
import { useSigner } from "@/lib/fx-provider/useSigner";
import { useUiStore } from "@/stores/ui";
import { CheckCircle2 } from "lucide-react";
import { useMemo, useState } from "react";

const ERROR_COPY: Record<OrderErrorCode, { title: string; desc: string }> = {
  ALLOWANCE_INSUFFICIENT: {
    title: "Allowance insufficient",
    desc: "Approve more or use a permit.",
  },
  INTENT_DEADLINE_EXPIRED: { title: "Order expired", desc: "Re-sign with a fresh deadline." },
  SLIPPAGE_EXCEEDED: {
    title: "Slippage exceeded",
    desc: "No liquidity at this price. Widen and retry.",
  },
  NO_LIQUIDITY: { title: "No liquidity", desc: "Try smaller size or different corridor." },
  QUOTE_STALE: { title: "Quote stale", desc: "Sign again with a fresh order." },
  AMOUNT_BELOW_MIN: { title: "Below minimum", desc: "Size is under the corridor floor." },
  STP_BLOCKED: { title: "Self-trade blocked", desc: "Cancel your opposite resting order." },
  INSUFFICIENT_EQUITY: {
    title: "Insufficient equity",
    desc: "Deposit more collateral to back this order.",
  },
  PAIR_INACTIVE: { title: "Pair inactive", desc: "This corridor is not tradeable right now." },
  TRANSIENT_SETTLEMENT_FAILURE: { title: "Temporary failure", desc: "Retry shortly." },
};

function explain(err: unknown): { title: string; desc: string } {
  if (err instanceof FxApiError && err.code && err.code in ERROR_COPY) {
    return ERROR_COPY[err.code as OrderErrorCode];
  }
  const msg = err instanceof Error ? err.message : String(err);
  return { title: "Sign failed", desc: msg.slice(0, 200) };
}

function fmtRate(r: number): string {
  if (r >= 100) return r.toFixed(2);
  if (r >= 10) return r.toFixed(3);
  return r.toFixed(4);
}

interface Props {
  corridor: Corridor;
}

function defaultExpiry(): { iso: string; label: string } {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return {
    iso: d.toISOString().slice(0, 10),
    label: d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }),
  };
}

export function DeliverableDrawer({ corridor }: Props) {
  const side = useUiStore((s) => s.drawer.side);
  const sizeRaw = useUiStore((s) => s.drawer.sizeRaw);
  const setDrawerSide = useUiStore((s) => s.setDrawerSide);
  const setDrawerSize = useUiStore((s) => s.setDrawerSize);
  const closeDrawer = useUiStore((s) => s.closeDrawer);

  const { signer } = useSigner();
  const baseSymbol = corridor.sym.split("/")[0];
  const quoteSymbol = corridor.sym.split("/")[1];
  const baseToken = useTokenBySymbol(baseSymbol);
  const quoteToken = useTokenBySymbol(quoteSymbol);

  // Live rate only — never sign at the static registry snapshot. If the live
  // feed is down, the confirm button is disabled rather than falling back.
  const fx = useFxRate(corridor.isoBase, corridor.isoQuote);
  const liveRate = fx.data ? Number.parseFloat(fx.data.rate) : null;

  const [pending, setPending] = useState(false);
  // Waitlist capture — real FX order path exists but is gated pending live verification.
  // TODO: remove gate once placeLimitOrder has been live-tested end-to-end.
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistSent, setWaitlistSent] = useState(false);
  const [waitlistPending, setWaitlistPending] = useState(false);

  const yesProb = useMemo(
    () => realisticYesProb(corridor.basis, corridor.seed),
    [corridor.basis, corridor.seed],
  );
  const isYes = side === "yes";
  const cents = Math.round((isYes ? yesProb : 1 - yesProb) * 100);
  const size = Number.parseFloat(sizeRaw) || 0;
  const shares = cents > 0 ? size / (cents / 100) : 0;
  const maxPayout = shares;
  const profit = maxPayout - size;
  const expiry = defaultExpiry();

  const presets = [25, 100, 500, 1000];

  async function confirm() {
    if (!signer || !baseToken || !quoteToken) {
      toast.error({
        title: "Not ready",
        description: signer ? "Token registry still loading" : "Connect wallet first",
      });
      return;
    }
    if (liveRate === null || liveRate <= 0) {
      toast.error({
        title: "Live rate unavailable",
        description: "Refusing to sign at a stale price. Retry shortly.",
      });
      return;
    }
    setPending(true);
    try {
      const orderSide: "bid" | "ask" = isYes ? "bid" : "ask";
      const sizeBase = String(size);
      const price = String(liveRate);
      const { fromAmountRaw, toAmountRaw } = buildOrderAmounts({
        side: orderSide,
        sizeBase,
        price,
        baseDecimals: baseToken.decimals,
        quoteDecimals: quoteToken.decimals,
      });
      const expirationTs = Math.floor(new Date(expiry.iso).getTime() / 1000);

      const result = await placeLimitOrder({
        signer,
        side: orderSide,
        fromAddress: baseToken.address,
        toAddress: quoteToken.address,
        amount: sizeBase,
        price,
        fromAmountRaw,
        toAmountRaw,
        expiration: expirationTs,
      });
      toast.success({
        title: `${isYes ? "YES" : "NO"} on ${corridor.sym}`,
        description: `${size.toFixed(2)} USDC · settles ${expiry.label} · id ${result.orderId.slice(0, 8)}…`,
      });
      closeDrawer();
    } catch (err) {
      const e = explain(err);
      toast.error({ title: e.title, description: e.desc });
    } finally {
      setPending(false);
    }
  }

  return (
    <div style={{ display: "flex", height: "100%", flexDirection: "column" }}>
      {/* Header */}
      <header
        style={{
          borderBottom: "1px solid var(--line)",
          padding: "24px 24px 18px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontFamily: "var(--f-tech)",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--yes)",
              background: "var(--yes-soft)",
              padding: "3px 9px",
              borderRadius: 6,
              border: "1px solid rgba(19,185,129,.3)",
            }}
          >
            Deliverable
          </span>
          <span
            style={{
              fontFamily: "var(--f-tech)",
              fontWeight: 700,
              fontSize: 15,
              color: "var(--ink)",
            }}
          >
            {corridor.sym}
          </span>
        </div>
        <h2
          style={{
            margin: "10px 0 0",
            fontFamily: "var(--f-display)",
            fontWeight: 700,
            fontSize: 17,
            lineHeight: 1.35,
            color: "var(--ink)",
          }}
        >
          Will {corridor.isoQuote}/{corridor.isoBase} settle below{" "}
          <span className="mono">{fmtRate(liveRate ?? corridor.refRate)}</span> on {expiry.label}?
        </h2>
        <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--muted)" }}>
          Fixed payout · settles in {corridor.isoQuote} onchain · no liquidations
        </p>
      </header>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
        {/* YES / NO selector */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <button
            type="button"
            onClick={() => setDrawerSide("yes")}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
              borderRadius: 12,
              border: side === "yes" ? "1px solid rgba(19,185,129,.5)" : "1px solid var(--line)",
              background: side === "yes" ? "rgba(19,185,129,.08)" : "#fff",
              padding: 12,
              textAlign: "left",
              cursor: "pointer",
              transition: "border-color .15s, background .15s",
            }}
          >
            <span style={{ fontSize: 12, color: "var(--muted)" }}>YES · settles below</span>
            <span className="mono" style={{ fontSize: 24, fontWeight: 700, color: "var(--yes)" }}>
              {Math.round(yesProb * 100)}¢
            </span>
            <span style={{ fontSize: 10, color: "var(--muted-2)" }}>pays $1.00 per share</span>
          </button>
          <button
            type="button"
            onClick={() => setDrawerSide("no")}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
              borderRadius: 12,
              border: side === "no" ? "1px solid rgba(240,67,106,.5)" : "1px solid var(--line)",
              background: side === "no" ? "rgba(240,67,106,.08)" : "#fff",
              padding: 12,
              textAlign: "left",
              cursor: "pointer",
              transition: "border-color .15s, background .15s",
            }}
          >
            <span style={{ fontSize: 12, color: "var(--muted)" }}>NO · settles at/above</span>
            <span className="mono" style={{ fontSize: 24, fontWeight: 700, color: "var(--no)" }}>
              {Math.round((1 - yesProb) * 100)}¢
            </span>
            <span style={{ fontSize: 10, color: "var(--muted-2)" }}>pays $1.00 per share</span>
          </button>
        </div>

        {/* Size input */}
        <div style={{ marginTop: 20 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <span
              style={{
                fontFamily: "var(--f-tech)",
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--muted)",
              }}
            >
              Position size
            </span>
            <span style={{ fontSize: 10, color: "var(--muted-2)" }}>USDC</span>
          </div>
          <input
            type="text"
            inputMode="decimal"
            value={sizeRaw}
            onChange={(e) => setDrawerSize(e.target.value.replace(/[^0-9.]/g, ""))}
            style={{
              fontFamily: "var(--f-tech)",
              width: "100%",
              borderRadius: 10,
              border: "1px solid var(--line)",
              background: "var(--bg-soft)",
              padding: "10px 12px",
              fontSize: 20,
              fontWeight: 600,
              color: "var(--ink)",
              outline: "none",
            }}
          />
          <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
            {presets.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setDrawerSize(String(p))}
                style={{
                  borderRadius: 999,
                  background: "var(--bg-tint)",
                  border: "1px solid var(--line)",
                  padding: "5px 12px",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--ink-2)",
                  cursor: "pointer",
                  transition: "background .15s",
                }}
              >
                ${p}
              </button>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div
          style={{
            marginTop: 20,
            borderRadius: 12,
            border: "1px solid var(--line)",
            background: "var(--bg-soft)",
            padding: 16,
          }}
        >
          <DRow label="Shares purchased" value={`${shares.toFixed(2)}`} />
          <DRow label="Cost basis" value={`$${size.toFixed(2)}`} />
          <DRow label="Max payout" value={`$${maxPayout.toFixed(2)}`} accent />
          <DRow
            label="Max profit"
            value={`+$${profit.toFixed(2)}`}
            accent
            tone={profit > 0 ? "green" : "neutral"}
          />
          <div
            style={{
              marginTop: 10,
              paddingTop: 10,
              borderTop: "1px solid var(--line)",
              fontSize: 11,
              color: "var(--muted)",
              lineHeight: 1.5,
            }}
          >
            Settles on <span style={{ color: "var(--ink)" }}>{expiry.label}</span> against the live
            oracle rate TWAP.
          </div>
        </div>

        {/* No-liquidation note */}
        <div
          style={{
            marginTop: 14,
            borderRadius: 12,
            border: "1px solid rgba(19,185,129,.3)",
            background: "rgba(19,185,129,.05)",
            padding: 12,
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
          }}
        >
          <CheckCircle2 size={14} style={{ flexShrink: 0, marginTop: 1, color: "var(--yes)" }} />
          <p style={{ margin: 0, fontSize: 11, lineHeight: 1.55, color: "var(--ink-2)" }}>
            <span style={{ color: "var(--ink)", fontWeight: 600 }}>No liquidations.</span> Your
            payout is locked at entry. If the market moves against you, you get back less than the
            max. You never lose more than you put in.
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer
        style={{
          borderTop: "1px solid var(--line)",
          padding: "16px 24px",
        }}
      >
        {/* Waitlist capture — deliverable forwards are not live yet.
            The real FX provider placeLimitOrder path is wired above (confirm()) and
            will be enabled once it has been verified end-to-end on mainnet. */}
        <div
          style={{
            marginBottom: 10,
            borderRadius: 8,
            border: "1px solid rgba(234,179,8,.3)",
            background: "rgba(234,179,8,.08)",
            padding: "10px 12px",
          }}
        >
          <div
            style={{
              fontFamily: "var(--f-tech)",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: ".1em",
              textTransform: "uppercase",
              color: "#92400e",
              marginBottom: 8,
            }}
          >
            Coming soon · Deliverable forwards
          </div>
          {waitlistSent ? (
            <p style={{ margin: 0, fontSize: 12, color: "var(--yes)", textAlign: "center" }}>
              Got it. We will notify you when deliverable forwards go live.
            </p>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const email = waitlistEmail.trim();
                if (!email) return;
                setWaitlistPending(true);
                try {
                  const res = await fetch("/api/waitlist", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, product: "predict-fx-deliverable" }),
                  });
                  if (res.ok) {
                    setWaitlistSent(true);
                    toast.success({
                      title: "You are on the waitlist",
                      description: "We will email you when deliverable forwards open.",
                    });
                  } else {
                    toast.error({
                      title: "Could not join waitlist",
                      description: "Check your email and try again.",
                    });
                  }
                } catch {
                  toast.error({ title: "Network error", description: "Try again in a moment." });
                } finally {
                  setWaitlistPending(false);
                }
              }}
              style={{ display: "flex", gap: 6 }}
            >
              <input
                type="email"
                required
                value={waitlistEmail}
                onChange={(e) => setWaitlistEmail(e.target.value)}
                placeholder="your@email.com"
                style={{
                  flex: 1,
                  borderRadius: 8,
                  border: "1px solid var(--line)",
                  background: "#fff",
                  padding: "8px 10px",
                  fontSize: 13,
                  fontFamily: "var(--f-ui)",
                  color: "var(--ink)",
                  outline: "none",
                }}
              />
              <Button
                type="submit"
                variant={isYes ? "yes" : "no"}
                size="sm"
                disabled={waitlistPending}
              >
                {waitlistPending ? "…" : "Notify me"}
              </Button>
            </form>
          )}
        </div>
        <p
          style={{
            marginTop: 8,
            textAlign: "center",
            fontSize: 10,
            color: "var(--muted)",
          }}
        >
          Settles onchain · self-custodial
        </p>
      </footer>
    </div>
  );
}

function DRow({
  label,
  value,
  accent,
  tone = "neutral",
}: {
  label: string;
  value: string;
  accent?: boolean;
  tone?: "neutral" | "green";
}) {
  const color = tone === "green" ? "var(--yes)" : "var(--ink)";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        fontSize: 12,
        marginBottom: 6,
      }}
    >
      <span style={{ color: "var(--muted)" }}>{label}</span>
      <span className="mono" style={{ fontWeight: accent ? 600 : 400, color }}>
        {value}
      </span>
    </div>
  );
}
