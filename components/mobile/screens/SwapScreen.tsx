"use client";

import { ConnectWalletButton } from "@/components/shared/ConnectWalletButton";
import { currencyFlag } from "@/lib/desks/currency";
import { useConfig, useQuotes, useTokens, useWalletBalances } from "@/lib/desks/hooks";
import {
  deskSubline,
  deskSublineTone,
  netHuman,
  networkCostLabel,
  rateFrom,
} from "@/lib/desks/quoteDisplay";
import type { NormalizedQuote } from "@/lib/desks/source";
import type { ApprovalDetail } from "@/lib/desks/useSwap";
import { useSwap } from "@/lib/desks/useSwap";
import { fmt, fromRaw, shortAddr } from "@/lib/fx-provider/core/format";
import type { FxToken } from "@/lib/fx-provider/core/types";
import { openExternal } from "@/lib/telegram/openExternal";
import { CHAIN } from "@/lib/wagmi/config";
import { useEffect, useState } from "react";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { Icon } from "../Icon";

interface SwapScreenProps {
  onBack?: () => void;
  onOpenMarkets?: () => void;
  onToast: (msg: string) => void;
  initialFrom?: string;
  initialTo?: string;
}

const ORDER: Array<"fx-provider" | "lifi" | "kyber" | "cow"> = ["fx-provider", "lifi", "kyber", "cow"];
const DESK_LABEL: Record<string, string> = {
  "fx-provider": "FX Provider",
  lifi: "LiFi",
  kyber: "KyberSwap",
  cow: "CoW",
};
const DESK_DETAIL: Record<string, string> = {
  "fx-provider": "orderbook · no slippage",
  lifi: "multi-chain aggregator",
  kyber: "DEX aggregator",
  cow: "intent · solver fills",
};

function explorerAddressUrl(chainId: number, address: string): string {
  if (chainId === 42161) return `https://arbiscan.io/address/${address}`;
  if (chainId === 8453) return `https://basescan.org/address/${address}`;
  return `https://etherscan.io/address/${address}`;
}

function ApprovalPanel({
  approval,
  fromTok,
  chainId,
}: {
  approval: ApprovalDetail;
  fromTok: FxToken | null;
  chainId: number;
}) {
  const decimals = fromTok?.decimals ?? 6;
  const symbol = fromTok?.symbol ?? "token";
  const humanAmount = fmt(Number(fromRaw(approval.amountRaw, decimals)), decimals <= 2 ? 2 : 4);
  const spenderShort = shortAddr(approval.spender);
  const explorerUrl = explorerAddressUrl(chainId, approval.spender);

  return (
    <div
      style={{
        marginTop: 10,
        padding: "10px 13px",
        borderRadius: 11,
        border: "1px solid rgba(99,102,241,.3)",
        background: "rgba(99,102,241,.06)",
        color: "#3730a3",
        fontSize: 12,
        lineHeight: 1.5,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontWeight: 700 }}>Approving {symbol}</span>
        <span style={{ fontFamily: "var(--f-tech)", fontWeight: 600 }}>
          {humanAmount} {symbol}
        </span>
      </div>
      <div style={{ marginTop: 4, opacity: 0.8 }}>
        Spender{" "}
        <button
          type="button"
          onClick={() => openExternal(explorerUrl)}
          style={{
            color: "inherit",
            textDecoration: "underline",
            fontFamily: "var(--f-tech)",
            background: "none",
            border: 0,
            cursor: "pointer",
            padding: 0,
            fontSize: "inherit",
          }}
        >
          {spenderShort}
        </button>
      </div>
      <div style={{ marginTop: 4, opacity: 0.65 }}>
        Revoke anytime at{" "}
        <button
          type="button"
          onClick={() => openExternal("https://revoke.cash")}
          style={{
            color: "inherit",
            textDecoration: "underline",
            background: "none",
            border: 0,
            cursor: "pointer",
            padding: 0,
            fontSize: "inherit",
          }}
        >
          revoke.cash
        </button>
      </div>
    </div>
  );
}

export function SwapScreen({
  onBack,
  onOpenMarkets,
  onToast,
  initialFrom,
  initialTo,
}: SwapScreenProps) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending: switching } = useSwitchChain();

  const { data: tokens = [] } = useTokens();
  const { balances } = useWalletBalances(address, tokens);
  const { data: config } = useConfig();
  const swap = useSwap();

  const [from, setFrom] = useState(initialFrom ?? "USDC");
  const [to, setTo] = useState(initialTo ?? "USDT");
  const [amtStr, setAmtStr] = useState("");
  const [picking, setPicking] = useState<null | "from" | "to">(null);
  const [q, setQ] = useState("");
  // selectedSource: which desk the user has tapped; null = follow best
  const [selectedSource, setSelectedSource] = useState<"fx-provider" | "lifi" | "kyber" | "cow" | null>(
    null,
  );

  // Resolve token objects for useQuotes
  const bySymbol: Record<string, FxToken> = {};
  for (const t of tokens) bySymbol[t.symbol] = t;
  const fromTok = bySymbol[from] ?? null;
  const toTok = bySymbol[to] ?? null;

  // User's real balance of the "pay" token (for the · Max affordance, like desktop).
  const fromWallet =
    fromTok && balances[fromTok.symbol]
      ? Number(fromRaw(balances[fromTok.symbol] ?? "0", fromTok.decimals))
      : 0;

  const flagFor = (sym: string) => {
    const t = bySymbol[sym];
    return t ? currencyFlag(t.currency) : "🏳️";
  };

  const amt = Number.parseFloat((amtStr || "").replace(/,/g, "")) || 0;

  const flip = () => {
    setFrom(to);
    setTo(from);
    setSelectedSource(null);
  };

  const choose = (sym: string) => {
    if (picking === "from") {
      setFrom(sym);
      if (sym === to) setTo(from);
    } else {
      setTo(sym);
      if (sym === from) setFrom(to);
    }
    setPicking(null);
    setQ("");
    setSelectedSource(null);
  };

  // ── Live quotes ──────────────────────────────────────────────────────────────
  const quotesQ = useQuotes(fromTok ?? undefined, toTok ?? undefined, amtStr, address);
  const data = quotesQ.data;

  // data.best is a source string from the server (ranking brain stays server-side).
  // Resolve active quote: selected desk (if ok) or server-recommended best.
  const bestSource = data?.best;
  const bestQuote: NormalizedQuote | undefined = bestSource
    ? data?.[bestSource]?.ok
      ? (data[bestSource] as { ok: true; quote: NormalizedQuote }).quote
      : undefined
    : undefined;
  const selectedResult = selectedSource && data ? data[selectedSource] : null;
  const activeQuote = (selectedResult?.ok ? selectedResult.quote : null) ?? bestQuote;
  const activeSource = activeQuote?.source ?? bestSource;

  // Reset selection when the selected desk loses its quote.
  useEffect(() => {
    if (!selectedSource || !data) return;
    const r = data[selectedSource];
    if (!r.ok) setSelectedSource(null);
  }, [data, selectedSource]);

  // "You receive" headline = net deliverable of the active quote.
  const outHuman = activeQuote && toTok ? netHuman(activeQuote, toTok.decimals) : 0;

  const hasAmount = amt > 0;
  const loadingQuotes = quotesQ.isFetching && hasAmount && !bestQuote;
  const wrongChain = isConnected && chainId !== CHAIN.id;

  // ── Swap status ──────────────────────────────────────────────────────────────
  const busy =
    swap.status === "signing" ||
    swap.status === "signing_permit" ||
    swap.status === "approving" ||
    swap.status === "submitting" ||
    swap.status === "confirming";

  // Toast on terminal states
  useEffect(() => {
    if (swap.status === "success" && swap.receipt) {
      onToast(`Settled · received ${swap.receipt.amount} ${swap.receipt.symbol}`);
    } else if (swap.status === "unconfirmed") {
      onToast(
        swap.orderStatusFailed401
          ? "Settlement tracking is temporarily unavailable — funds typically arrive within a minute. Check your balance."
          : "Submitted · confirmation pending · check your balances",
      );
    } else if (swap.status === "error" && swap.error) {
      onToast(`Swap failed: ${swap.error}`);
    }
  }, [swap.status, swap.receipt, swap.error, swap.orderStatusFailed401, onToast]);

  // ── Button label (connected + right chain only) ──────────────────────────────
  function buttonLabel(): string {
    if (swap.status === "signing") return "Sign swap in wallet…";
    if (swap.status === "signing_permit") return "Sign permit in wallet…";
    if (swap.status === "approving") return "Approve token in wallet…";
    if (swap.status === "submitting") return "Submitting…";
    if (swap.status === "confirming") return "Confirming…";
    if (swap.status === "success") return "New swap";
    if (swap.status === "error") return "Retry";
    if (!hasAmount) return "Enter an amount";
    if (loadingQuotes) return "Finding best rate…";
    if (activeQuote) {
      const label = activeSource === "fx-provider" ? "FX Provider" : (activeQuote.toolName ?? activeSource ?? "");
      return `Swap via ${label}`;
    }
    if (data && !data["fx-provider"].ok && !data.lifi.ok && !data.kyber.ok && !data.cow.ok)
      return "No route for this pair";
    return "Enter an amount";
  }

  const handleSwap = () => {
    if (swap.status === "success" || swap.status === "error") {
      swap.reset();
      return;
    }
    if (!activeQuote || busy) return;
    swap.execute(activeQuote, config);
  };

  const canPress =
    !busy && (swap.status === "success" || swap.status === "error" || (!!activeQuote && hasAmount));

  // ── Token picker sub-screen ──────────────────────────────────────────────────
  if (picking) {
    const exclude = picking === "from" ? to : from;
    const f = q.trim().toLowerCase();
    const list = tokens.filter(
      (t) =>
        t.symbol !== exclude &&
        (!f || t.symbol.toLowerCase().includes(f) || (t.name ?? "").toLowerCase().includes(f)),
    );
    return (
      <div className="screen fade-in">
        <div className="appbar">
          <button
            type="button"
            className="iconbtn"
            onClick={() => {
              setPicking(null);
              setQ("");
            }}
            aria-label="Back"
          >
            <Icon name="back" size={20} />
          </button>
          <div className="ab-title" style={{ fontSize: 20 }}>
            {picking === "from" ? "You pay" : "You receive"}
          </div>
        </div>
        <div
          style={{
            margin: "0 18px 12px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "#fff",
            border: "1px solid var(--line)",
            borderRadius: 12,
            padding: "11px 13px",
          }}
        >
          <Icon name="search" size={18} color="var(--muted-2)" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name or symbol…"
            style={{
              flex: 1,
              border: 0,
              outline: "none",
              background: "none",
              fontFamily: "var(--f-ui)",
              fontSize: 15,
            }}
          />
        </div>
        <div className="listwrap">
          {list.map((t) => (
            <div
              className="pk-row"
              key={t.symbol}
              onClick={() => choose(t.symbol)}
              style={{ padding: "13px 15px" }}
            >
              <span className="fl">{currencyFlag(t.currency)}</span>
              <span
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 3,
                  minWidth: 0,
                  lineHeight: 1.2,
                }}
              >
                <span className="sy">{t.symbol}</span>
                <span className="nm" style={{ marginTop: 0 }}>
                  {t.name ?? t.currency}
                </span>
              </span>
              <span className={`badge${t.sources?.includes("lifi") ? "" : " fx"}`}>
                {t.sources?.includes("lifi") ? "DEX" : "orderbook"}
              </span>
            </div>
          ))}
          {list.length === 0 && (
            <div
              style={{ padding: 30, textAlign: "center", color: "var(--muted-2)", fontSize: 13 }}
            >
              No tokens match &quot;{q}&quot;.
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Main swap screen ─────────────────────────────────────────────────────────
  return (
    <div className="screen fade-in">
      <div className="appbar">
        {onBack && (
          <button type="button" className="iconbtn" onClick={onBack} aria-label="Back">
            <Icon name="back" size={20} />
          </button>
        )}
        <div className="ab-title">Swap FX</div>
        <span className="grow" />
      </div>

      <div style={{ margin: "0 18px" }}>
        <div className="eyebrow" style={{ marginBottom: 12 }}>
          <span className="tick" />
          Non-custodial · you sign every swap
        </div>

        <div className="swap-panel">
          <div className="sp-top">
            <span>You pay</span>
            {fromTok && fromWallet > 0 && (
              <button
                type="button"
                onClick={() => setAmtStr(String(fromWallet))}
                style={{
                  background: "none",
                  border: 0,
                  padding: 0,
                  cursor: "pointer",
                  color: "var(--brand)",
                  fontFamily: "var(--f-tech)",
                  fontWeight: 700,
                  fontSize: 12,
                }}
              >
                {fmt(fromWallet, 4)} {fromTok.symbol} · Max
              </button>
            )}
          </div>
          <div className="sp-row">
            <button type="button" className="tokbtn" onClick={() => setPicking("from")}>
              <span className="fl">{flagFor(from)}</span>
              {from}
              <span className="ca">▾</span>
            </button>
            <input
              className="right"
              value={amtStr}
              onChange={(e) => {
                setAmtStr(e.target.value.replace(/[^0-9.,]/g, ""));
                if (swap.status === "success" || swap.status === "error") swap.reset();
              }}
              inputMode="decimal"
              placeholder="0.0"
            />
          </div>
        </div>

        <div className="swap-flip">
          <button type="button" onClick={flip} aria-label="Flip tokens">
            <Icon name="swap" size={18} color="var(--brand)" />
          </button>
        </div>

        <div className="swap-panel">
          <div className="sp-top">
            <span>You receive</span>
          </div>
          <div className="sp-row">
            <button type="button" className="tokbtn" onClick={() => setPicking("to")}>
              <span className="fl">{flagFor(to)}</span>
              {to}
              <span className="ca">▾</span>
            </button>
            <input
              className="right"
              value={
                swap.status === "success" && swap.receipt
                  ? swap.receipt.amount
                  : outHuman
                    ? fmt(outHuman, toTok ? (toTok.decimals <= 2 ? 2 : 4) : 4)
                    : loadingQuotes
                      ? "…"
                      : ""
              }
              readOnly
              placeholder="0.0"
              style={{ color: "var(--ink)" }}
            />
          </div>
        </div>

        {/* ── Rate breakdown ── */}
        {activeQuote && toTok && fromTok && outHuman > 0 && (
          <div
            style={{
              marginTop: 10,
              padding: "10px 13px",
              borderRadius: 11,
              border: "1px solid var(--line)",
              background: "#fff",
              fontSize: 12,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                color: "var(--muted)",
                marginBottom: 4,
              }}
            >
              <span>Rate</span>
              <span style={{ fontFamily: "var(--f-tech)", fontWeight: 600, color: "var(--ink-2)" }}>
                {rateFrom(amtStr || "1", outHuman, fromTok.symbol, toTok.symbol)}
              </span>
            </div>
            <div
              style={{ display: "flex", justifyContent: "space-between", color: "var(--muted)" }}
            >
              <span>Network cost</span>
              <span style={{ fontFamily: "var(--f-tech)", fontWeight: 600, color: "var(--ink-2)" }}>
                {networkCostLabel(activeQuote)}
              </span>
            </div>
          </div>
        )}

        {/* ── Approval detail panel ── */}
        {swap.status === "approving" && swap.approval && (
          <ApprovalPanel approval={swap.approval} fromTok={fromTok} chainId={chainId} />
        )}

        {/* Status inline banners */}
        {swap.status === "confirming" && (
          <div
            style={{
              marginTop: 10,
              padding: "9px 13px",
              borderRadius: 11,
              border: "1px solid rgba(99,102,241,.3)",
              background: "rgba(99,102,241,.06)",
              color: "#3730a3",
              fontSize: 12,
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>Confirming settlement…</span>
            <span style={{ opacity: 0.7 }}>up to 90s</span>
          </div>
        )}

        {swap.status === "success" && swap.receipt && (
          <div
            style={{
              marginTop: 10,
              padding: "9px 13px",
              borderRadius: 11,
              border: "1px solid rgba(19,185,129,.4)",
              background: "rgba(19,185,129,.08)",
              color: "#0a7a53",
              fontSize: 12,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>
              Settled · received {swap.receipt.amount} {swap.receipt.symbol}
            </span>
          </div>
        )}

        {swap.status === "unconfirmed" && (
          <div
            style={{
              marginTop: 10,
              padding: "9px 13px",
              borderRadius: 11,
              border: "1px solid rgba(234,179,8,.5)",
              background: "rgba(234,179,8,.08)",
              color: "#854d0e",
              fontSize: 12,
            }}
          >
            {swap.orderStatusFailed401
              ? "Settlement tracking is temporarily unavailable — funds typically arrive within a minute. Check your balance."
              : "Submitted · confirmation pending · check your balances"}
          </div>
        )}

        {swap.status === "error" && swap.error && (
          <div
            style={{
              marginTop: 10,
              padding: "9px 13px",
              borderRadius: 11,
              border: "1px solid rgba(240,67,106,.4)",
              background: "rgba(240,67,106,.08)",
              color: "#b61441",
              fontSize: 12,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {swap.error}
          </div>
        )}

        {!isConnected ? (
          <ConnectWalletButton style={{ marginTop: 14 }} />
        ) : wrongChain ? (
          <button
            type="button"
            className="btn btn-primary btn-block btn-lg"
            style={{ marginTop: 14, opacity: switching ? 0.6 : 1 }}
            disabled={switching}
            onClick={() => switchChain({ chainId: CHAIN.id })}
          >
            {switching ? "Switching…" : `Switch to ${CHAIN.name}`}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary btn-block btn-lg"
            style={{
              marginTop: 14,
              opacity: canPress ? 1 : 0.5,
            }}
            disabled={!canPress}
            onClick={handleSwap}
          >
            {buttonLabel()}
          </button>
        )}
      </div>

      <div className="sec-head onlight" style={{ marginTop: 26 }}>
        <div>
          <div className="eyebrow-sm">Net after all fees, slippage &amp; gas — tap to select</div>
          <h2 style={{ marginTop: 4 }}>Live quotes, ranked</h2>
        </div>
      </div>

      <div style={{ margin: "0 18px" }}>
        {ORDER.map((d) => {
          const result = data?.[d];
          const isBest = !!bestSource && bestSource === d;
          const isSelected = selectedSource ? selectedSource === d : isBest;

          if (!hasAmount || !result) {
            return (
              <div className="desk" key={d}>
                <div>
                  <div className="nm">{DESK_LABEL[d]}</div>
                  <div className="via">{DESK_DETAIL[d]}</div>
                </div>
                <span
                  style={{ fontFamily: "var(--f-tech)", fontSize: 12, color: "var(--muted-2)" }}
                >
                  {hasAmount && loadingQuotes ? "…" : "—"}
                </span>
              </div>
            );
          }

          if (!result.ok) {
            return (
              <div className="desk" key={d} style={{ opacity: 0.55 }}>
                <div>
                  <div className="nm">{DESK_LABEL[d]}</div>
                  <div className="via">{DESK_DETAIL[d]}</div>
                </div>
                <span
                  style={{ fontFamily: "var(--f-tech)", fontSize: 12, color: "var(--muted-2)" }}
                >
                  no route
                </span>
              </div>
            );
          }

          const quote = result.quote;
          const outNum = toTok ? netHuman(quote, toTok.decimals) : 0;
          const subline = deskSubline(quote);
          const subTone = deskSublineTone(quote);
          const via = d !== "fx-provider" && quote.toolName ? `via ${quote.toolName}` : DESK_DETAIL[d];

          return (
            <button
              type="button"
              className="desk"
              key={d}
              onClick={() => setSelectedSource(d)}
              aria-pressed={isSelected}
              aria-label={`Use ${DESK_LABEL[d]} — ${fmt(outNum, 4)} ${toTok?.symbol ?? ""}`}
              style={
                isSelected
                  ? {
                      border: "2px solid var(--brand)",
                      boxShadow: "0 0 0 1px var(--brand) inset",
                      background: "linear-gradient(180deg,#fff,var(--bg-tint))",
                      cursor: "pointer",
                    }
                  : { cursor: "pointer" }
              }
            >
              <div>
                <div className="nm">
                  {DESK_LABEL[d]}
                  {isBest && <span className="bestpill">Best</span>}
                </div>
                <div className="via">{via}</div>
              </div>
              <div style={{ textAlign: "right" as const }}>
                <div
                  style={{
                    fontFamily: "var(--f-tech)",
                    fontWeight: 700,
                    fontSize: 15,
                    color: "var(--ink)",
                  }}
                >
                  {fmt(outNum, 4)} {toTok?.symbol}
                </div>
                <div
                  style={{
                    fontSize: 10.5,
                    marginTop: 2,
                    color: subTone === "ok" ? "var(--yes)" : "var(--muted-2)",
                  }}
                >
                  {subline}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div
        style={{
          display: "flex",
          gap: 9,
          margin: "16px 18px 6px",
          color: "var(--muted)",
          fontSize: 11.5,
          lineHeight: 1.5,
        }}
      >
        <Icon name="info" size={15} color="var(--accent-2)" />
        <span>
          Every number is what actually lands in your wallet after that venue&apos;s fees, slippage,
          and network gas. Tap any quote to use that venue instead of our pick.
        </span>
      </div>
      <div style={{ height: 8 }} />
      {onOpenMarkets && (
        <button
          type="button"
          onClick={onOpenMarkets}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "calc(100% - 36px)",
            margin: "12px 18px 18px",
            padding: "14px 16px",
            background: "var(--bg-tint)",
            border: "1px solid var(--line)",
            borderRadius: 16,
            cursor: "pointer",
          }}
        >
          <span style={{ textAlign: "left" }}>
            <span style={{ display: "block", fontWeight: 700, fontSize: 14 }}>
              Browse FX markets
            </span>
            <span style={{ display: "block", fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
              Live corridor rates · tap a pair to load it here
            </span>
          </span>
          <span style={{ color: "var(--brand)", fontWeight: 800 }}>→</span>
        </button>
      )}
    </div>
  );
}
