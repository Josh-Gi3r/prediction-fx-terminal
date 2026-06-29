"use client";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { type Corridor, spreadBps } from "@/lib/corridors/registry";
import { useFxRate, useTokenBySymbol } from "@/lib/fx-provider/hooks";
import { buildOrderAmounts, placeLimitOrder } from "@/lib/fx-provider/orders";
import { type OrderErrorCode, FxApiError } from "@/lib/fx-provider/types";
import { useSigner } from "@/lib/fx-provider/useSigner";
import { useState } from "react";

interface Props {
  corridor: Corridor;
}

function fmtRate(r: number): string {
  if (r >= 100) return r.toFixed(2);
  if (r >= 10) return r.toFixed(3);
  return r.toFixed(4);
}

const ERROR_COPY: Record<OrderErrorCode, { title: string; desc: string }> = {
  ALLOWANCE_INSUFFICIENT: {
    title: "Allowance insufficient",
    desc: "Approve more or use a permit. Try again.",
  },
  INTENT_DEADLINE_EXPIRED: {
    title: "Order expired",
    desc: "Your signed order expired before submission. Re-sign.",
  },
  SLIPPAGE_EXCEEDED: {
    title: "Slippage exceeded",
    desc: "No crossing liquidity at this price. Widen and retry.",
  },
  NO_LIQUIDITY: {
    title: "No liquidity",
    desc: "No depth at this price. Try smaller size or different pair.",
  },
  QUOTE_STALE: { title: "Quote stale", desc: "Sign again with a fresh order." },
  AMOUNT_BELOW_MIN: {
    title: "Below minimum",
    desc: "Size is under the corridor's minimum trade amount.",
  },
  STP_BLOCKED: {
    title: "Self-trade blocked",
    desc: "You have a resting order on the opposite side. Cancel it or change side.",
  },
  INSUFFICIENT_EQUITY: {
    title: "Insufficient equity",
    desc: "Deposit more collateral to back this order.",
  },
  PAIR_INACTIVE: { title: "Pair inactive", desc: "This corridor is not currently tradeable." },
  TRANSIENT_SETTLEMENT_FAILURE: {
    title: "Temporary failure",
    desc: "Settlement failed temporarily. Retry shortly.",
  },
};

function explain(err: unknown): { title: string; desc: string } {
  if (err instanceof FxApiError && err.code && err.code in ERROR_COPY) {
    return ERROR_COPY[err.code as OrderErrorCode];
  }
  const msg = err instanceof Error ? err.message : String(err);
  return { title: "Sign failed", desc: msg.slice(0, 200) };
}

export function EntryPanel({ corridor }: Props) {
  const { signer } = useSigner();
  const baseToken = useTokenBySymbol(corridor.sym.split("/")[0]);
  const quoteToken = useTokenBySymbol(corridor.sym.split("/")[1]);

  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [orderType, setOrderType] = useState<"limit" | "market">("limit");
  const [size, setSize] = useState("100");
  const [price, setPrice] = useState(fmtRate(corridor.refRate));
  const [postOnly, setPostOnly] = useState(false);
  const [pending, setPending] = useState(false);

  const spread = spreadBps(corridor.tier);
  // Live mark only — the static registry refRate is a display fallback and
  // must never reach a signature. Market orders are blocked while it's down.
  const fx = useFxRate(corridor.isoBase, corridor.isoQuote);
  const liveMark = fx.data ? Number.parseFloat(fx.data.rate) : null;
  const mark = liveMark ?? corridor.refRate;
  const sizeN = Number.parseFloat(size) || 0;
  const priceN = Number.parseFloat(price) || mark;
  const total = orderType === "market" ? sizeN * mark : sizeN * priceN;

  const canSubmit =
    signer && baseToken && quoteToken && sizeN > 0 && (orderType === "limit" || liveMark !== null);

  async function submit() {
    if (!signer || !baseToken || !quoteToken) {
      toast.error({
        title: "Not ready",
        description: signer ? "Token registry still loading" : "Connect wallet first",
      });
      return;
    }
    setPending(true);
    try {
      const orderSide = side === "buy" ? "bid" : "ask";
      const useMark = orderType === "market";
      if (useMark && liveMark === null) {
        toast.error({
          title: "Live rate unavailable",
          description: "Market orders need a live mark. Use a limit price or retry.",
        });
        return;
      }
      const px = useMark ? (liveMark as number) : priceN;
      const { fromAmountRaw, toAmountRaw } = buildOrderAmounts({
        side: orderSide,
        sizeBase: String(sizeN),
        price: String(px),
        baseDecimals: baseToken.decimals,
        quoteDecimals: quoteToken.decimals,
      });

      const result = await placeLimitOrder({
        signer,
        side: orderSide,
        fromAddress: baseToken.address,
        toAddress: quoteToken.address,
        amount: String(sizeN),
        price: String(px),
        fromAmountRaw,
        toAmountRaw,
        expiration: Math.floor(Date.now() / 1000) + 24 * 3600,
      });
      toast.success({
        title: `${side === "buy" ? "Buy" : "Sell"} order placed`,
        description: `${sizeN.toFixed(2)} ${corridor.isoQuote} @ ${fmtRate(px)} · id ${result.orderId.slice(0, 8)}…`,
      });
    } catch (err) {
      const e = explain(err);
      toast.error({ title: e.title, description: e.desc });
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: "var(--r-lg)",
        boxShadow: "var(--sh-1)",
        padding: 16,
      }}
    >
      {/* Panel header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
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
          Place order
        </span>
        <span style={{ fontFamily: "var(--f-tech)", fontSize: 10, color: "var(--muted-2)" }}>
          spread {spread} bps
        </span>
      </div>

      {/* Buy / Sell toggle */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 6,
          marginBottom: 12,
        }}
      >
        <button
          type="button"
          onClick={() => setSide("buy")}
          style={{
            borderRadius: 9,
            padding: "9px 0",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            border: "1px solid transparent",
            background: side === "buy" ? "var(--yes-soft)" : "var(--bg-tint)",
            color: side === "buy" ? "var(--yes)" : "var(--ink-2)",
            transition: "background .15s, color .15s",
          }}
        >
          Buy
        </button>
        <button
          type="button"
          onClick={() => setSide("sell")}
          style={{
            borderRadius: 9,
            padding: "9px 0",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            border: "1px solid transparent",
            background: side === "sell" ? "var(--no-soft)" : "var(--bg-tint)",
            color: side === "sell" ? "var(--no)" : "var(--ink-2)",
            transition: "background .15s, color .15s",
          }}
        >
          Sell
        </button>
      </div>

      {/* Limit / Market toggle */}
      <div
        style={{
          display: "inline-flex",
          borderRadius: 9,
          background: "var(--bg-tint)",
          padding: 3,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        {(["limit", "market"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setOrderType(t)}
            style={{
              borderRadius: 7,
              padding: "5px 14px",
              fontWeight: 600,
              cursor: "pointer",
              border: "none",
              background: orderType === t ? "#fff" : "transparent",
              color: orderType === t ? "var(--ink)" : "var(--muted)",
              boxShadow: orderType === t ? "var(--sh-1)" : "none",
              textTransform: "capitalize",
              transition: "background .15s, color .15s",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {orderType === "limit" && (
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 4,
                fontFamily: "var(--f-tech)",
                fontSize: 10,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--muted)",
              }}
            >
              <span>Price</span>
              <button
                type="button"
                onClick={() => setPrice(fmtRate(mark))}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 10,
                  color: "var(--brand)",
                  fontWeight: 600,
                }}
              >
                use mark
              </button>
            </div>
            <input
              type="text"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ""))}
              style={{
                fontFamily: "var(--f-tech)",
                width: "100%",
                borderRadius: 9,
                border: "1px solid var(--line)",
                background: "var(--bg-soft)",
                padding: "8px 10px",
                fontSize: 14,
                color: "var(--ink)",
                outline: "none",
              }}
            />
          </div>
        )}

        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 4,
              fontFamily: "var(--f-tech)",
              fontSize: 10,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--muted)",
            }}
          >
            <span>Size · {corridor.isoQuote}</span>
            <span>{sizeN > 0 ? `~${(sizeN * priceN).toFixed(2)} USDC` : "—"}</span>
          </div>
          <input
            type="text"
            inputMode="decimal"
            value={size}
            onChange={(e) => setSize(e.target.value.replace(/[^0-9.]/g, ""))}
            style={{
              fontFamily: "var(--f-tech)",
              width: "100%",
              borderRadius: 9,
              border: "1px solid var(--line)",
              background: "var(--bg-soft)",
              padding: "8px 10px",
              fontSize: 14,
              color: "var(--ink)",
              outline: "none",
            }}
          />
        </div>

        {orderType === "limit" && (
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 11,
              color: "var(--ink-2)",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={postOnly}
              onChange={(e) => setPostOnly(e.target.checked)}
              style={{ width: 14, height: 14, accentColor: "var(--brand)" }}
            />
            Post-only (maker rebate eligible)
          </label>
        )}
      </div>

      {/* Order summary */}
      <div
        style={{
          marginTop: 14,
          borderRadius: 9,
          background: "var(--bg-soft)",
          border: "1px solid var(--line)",
          padding: "10px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
          fontSize: 11,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "var(--muted)" }}>Order total</span>
          <span className="mono" style={{ color: "var(--ink)" }}>
            {total.toFixed(2)} USDC
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "var(--muted)" }}>Maker fee</span>
          <span className="mono" style={{ color: "var(--ink-2)" }}>
            +0 bps
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "var(--muted)" }}>Taker fee</span>
          <span className="mono" style={{ color: "var(--ink-2)" }}>
            2.5 bps
          </span>
        </div>
      </div>

      <Button
        variant={side === "buy" ? "long" : "short"}
        size="lg"
        className={cn("mt-4 w-full")}
        onClick={submit}
        disabled={!canSubmit || pending}
      >
        {pending
          ? "Signing…"
          : !signer
            ? "Connect wallet"
            : `${side === "buy" ? "Buy" : "Sell"} ${sizeN.toFixed(2)} ${corridor.isoQuote}`}
      </Button>
    </div>
  );
}
