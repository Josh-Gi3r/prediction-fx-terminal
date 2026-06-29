"use client";

import { currencyFlag } from "@/lib/desks/currency";
import { useConfig, useQuotes, useTokens, useWalletBalances } from "@/lib/desks/hooks";
import type { QuotesData } from "@/lib/desks/hooks";
import {
  deskSubline,
  deskSublineTone,
  netHuman,
  networkCostLabel,
  rateFrom,
} from "@/lib/desks/quoteDisplay";
import type { NormalizedQuote, QuoteResult } from "@/lib/desks/source";
import type { ApprovalDetail } from "@/lib/desks/useSwap";
import { useSwap } from "@/lib/desks/useSwap";
import { fmt, fromRaw, shortAddr } from "@/lib/fx-provider/core/format";
import type { FxToken } from "@/lib/fx-provider/core/types";
import { useEffect, useState } from "react";
import { useAccount, useChainId } from "wagmi";
import { ConnectButton } from "./ConnectButton";
import { FaucetButton } from "./FaucetButton";
import { TokenPicker } from "./TokenPicker";

const DEFAULT_FROM = "USDC";
const DEFAULT_TO = "USDT";

const ORDER: Array<"fx-provider" | "lifi" | "kyber" | "cow"> = ["fx-provider", "lifi", "kyber", "cow"];
const DESK_LABEL: Record<string, string> = {
  "fx-provider": "FX Provider",
  lifi: "LiFi",
  kyber: "KyberSwap",
  cow: "CoW",
};
const DESK_DETAIL: Record<string, string> = {
  "fx-provider": "orderbook · no slippage",
  lifi: "DEX aggregator",
  kyber: "DEX aggregator",
  cow: "intent · solver fills",
};

export function SwapCard({
  pending,
  onConsumed,
}: {
  pending?: { from: FxToken; to: FxToken } | null;
  onConsumed?: () => void;
} = {}) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { data: tokens } = useTokens();
  const { balances } = useWalletBalances(address, tokens);
  const { data: config } = useConfig();
  const swap = useSwap();

  const [fromTok, setFromTok] = useState<FxToken | null>(null);
  const [toTok, setToTok] = useState<FxToken | null>(null);
  const [amount, setAmount] = useState("");
  const [picker, setPicker] = useState<null | "from" | "to">(null);
  // selectedSource: which desk the user has clicked; null = follow best
  const [selectedSource, setSelectedSource] = useState<"fx-provider" | "lifi" | "kyber" | "cow" | null>(
    null,
  );

  useEffect(() => {
    if (!tokens) return;
    setFromTok((p) => p ?? tokens.find((t) => t.symbol === DEFAULT_FROM) ?? tokens[0] ?? null);
    setToTok((p) => p ?? tokens.find((t) => t.symbol === DEFAULT_TO) ?? tokens[1] ?? null);
  }, [tokens]);

  // Pair preset from Markets → swap directly.
  useEffect(() => {
    if (pending) {
      setFromTok(pending.from);
      setToTok(pending.to);
      setAmount("");
      setSelectedSource(null);
      onConsumed?.();
    }
  }, [pending, onConsumed]);

  const quotesQ = useQuotes(fromTok ?? undefined, toTok ?? undefined, amount, address);
  const data = quotesQ.data;

  // Resolve which quote to use for headline/rate/button.
  // data.best is a source string from the server (ranking brain stays server-side).
  // If selectedSource is set and that desk has an ok quote, use it.
  // Otherwise fall back to the server-recommended best.
  const bestSource = data?.best;
  const bestQuote: NormalizedQuote | undefined = bestSource
    ? data?.[bestSource]?.ok
      ? (data[bestSource] as { ok: true; quote: NormalizedQuote }).quote
      : undefined
    : undefined;
  const selectedResult = selectedSource && data ? data[selectedSource] : null;
  const activeQuote = (selectedResult?.ok ? selectedResult.quote : null) ?? bestQuote;
  const activeSource = activeQuote?.source ?? bestSource;

  // When available desks change (new quote cycle), reset selection if the
  // previously selected source is no longer available.
  useEffect(() => {
    if (!selectedSource || !data) return;
    const r = data[selectedSource];
    if (!r.ok) setSelectedSource(null);
  }, [data, selectedSource]);

  // Button is disabled during all in-progress phases including confirming.
  const busy =
    swap.status === "signing" ||
    swap.status === "signing_permit" ||
    swap.status === "approving" ||
    swap.status === "submitting" ||
    swap.status === "confirming";

  // "You receive" headline = net deliverable of the active (selected or best) quote.
  const outHuman = activeQuote && toTok ? netHuman(activeQuote, toTok.decimals) : 0;
  const fromWallet =
    fromTok && balances[fromTok.symbol]
      ? Number(fromRaw(balances[fromTok.symbol] ?? "0", fromTok.decimals))
      : 0;
  const hasAmount = !!amount && Number(amount) > 0;
  const loadingQuotes = quotesQ.isFetching && hasAmount && !bestQuote;
  const noRoute =
    hasAmount &&
    !loadingQuotes &&
    !!data &&
    !data["fx-provider"].ok &&
    !data.lifi.ok &&
    !data.kyber.ok &&
    !data.cow.ok;

  function flip() {
    setFromTok(toTok);
    setToTok(fromTok);
    setSelectedSource(null);
  }
  function pick(t: FxToken) {
    if (picker === "from") {
      if (toTok && t.address === toTok.address) setToTok(fromTok);
      setFromTok(t);
    } else {
      if (fromTok && t.address === fromTok.address) setFromTok(toTok);
      setToTok(t);
    }
    setPicker(null);
    setSelectedSource(null);
  }

  return (
    <section className="wrap swrap">
      <SwapStyles />

      {/* SWAP CARD */}
      <div className="swap">
        <div className="swap-h">
          <h2>Swap FX</h2>
          <FaucetButton />
        </div>

        <div className="panel">
          <div className="pl">
            <span>You pay</span>
            {isConnected && fromTok ? (
              <button type="button" className="max" onClick={() => setAmount(String(fromWallet))}>
                {fmt(fromWallet, 4)} {fromTok.symbol} · Max
              </button>
            ) : null}
          </div>
          <div className="prow">
            <TokButton token={fromTok} onClick={() => setPicker("from")} />
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => /^\d*\.?\d*$/.test(e.target.value) && setAmount(e.target.value)}
              placeholder="0.0"
            />
          </div>
        </div>

        <div className="flipwrap">
          <button type="button" className="flip" onClick={flip} aria-label="Flip tokens">
            ↓↑
          </button>
        </div>

        <div className="panel">
          <div className="pl">
            <span>You receive</span>
          </div>
          <div className="prow">
            <TokButton token={toTok} onClick={() => setPicker("to")} />
            <input disabled value={outHuman ? fmt(outHuman, 6) : ""} placeholder="0.0" />
          </div>
        </div>

        {activeQuote && toTok && fromTok && outHuman > 0 && (
          <div className="brk">
            <div className="r">
              <span className="k">Rate</span>
              <span className="v">
                {rateFrom(amount || "1", outHuman, fromTok.symbol, toTok.symbol)}
              </span>
            </div>
            <div className="r">
              <span className="k">Network cost</span>
              <span className="v">{networkCostLabel(activeQuote)}</span>
            </div>
            {activeQuote.source === "cow" && (
              <div className="cow">
                <strong>CoW is an intent.</strong> A solver fills it in a batch auction. Not an
                instant onchain swap; it may fill at your min or not at all.
              </div>
            )}
          </div>
        )}

        {noRoute && <NoRouteHelp fromTok={fromTok} toTok={toTok} />}

        <div id="action">
          {!isConnected ? (
            <div style={{ marginTop: 14, display: "flex", justifyContent: "center" }}>
              <ConnectButton />
            </div>
          ) : (
            <button
              type="button"
              className="swapbtn"
              onClick={() => activeQuote && swap.execute(activeQuote, config)}
              disabled={!activeQuote || busy}
            >
              {buttonLabel(swap.status, hasAmount, loadingQuotes, activeQuote, activeSource, data)}
            </button>
          )}
        </div>

        {/* ── Approval detail panel ── */}
        {swap.status === "approving" && swap.approval && (
          <ApprovalPanel approval={swap.approval} fromTok={fromTok} chainId={chainId} />
        )}

        {/* ── Confirming spinner ── */}
        {swap.status === "confirming" && (
          <StatusBanner tone="pending">
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <ConfirmSpinner />
              Confirming settlement…
            </span>
            <span
              style={{
                fontFamily: "var(--f-tech)",
                fontSize: 11,
                color: "inherit",
                opacity: 0.7,
                flexShrink: 0,
              }}
            >
              up to 90s
            </span>
          </StatusBanner>
        )}

        {/* ── Settled — received X ── */}
        {swap.status === "success" && (
          <StatusBanner tone="success">
            <span>
              {swap.receipt
                ? `Settled · received ${swap.receipt.amount} ${swap.receipt.symbol}`
                : `Settled${swap.tradeId ? ` · ${shortAddr(swap.tradeId)}` : ""}`}
            </span>
            <button
              type="button"
              onClick={() => {
                swap.reset();
                setAmount("");
                setSelectedSource(null);
              }}
              style={{
                textDecoration: "underline",
                background: "none",
                border: 0,
                cursor: "pointer",
                color: "inherit",
                flexShrink: 0,
              }}
            >
              New swap
            </button>
          </StatusBanner>
        )}

        {/* ── Unconfirmed — honest copy ── */}
        {swap.status === "unconfirmed" && (
          <StatusBanner tone="warn">
            <span>
              {swap.orderStatusFailed401 ? (
                "Settlement tracking is temporarily unavailable — funds typically arrive within a minute. Check your balance."
              ) : (
                <>
                  Submitted · confirmation pending · check your balances
                  {swap.tradeId ? ` · ${shortAddr(swap.tradeId)}` : ""}
                </>
              )}
            </span>
            <button
              type="button"
              onClick={() => {
                swap.reset();
                setAmount("");
                setSelectedSource(null);
              }}
              style={{
                textDecoration: "underline",
                background: "none",
                border: 0,
                cursor: "pointer",
                color: "inherit",
                flexShrink: 0,
              }}
            >
              Dismiss
            </button>
          </StatusBanner>
        )}

        {swap.status === "error" && swap.error && (
          <StatusBanner tone="error">
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {swap.error}
            </span>
            <button
              type="button"
              onClick={swap.reset}
              style={{
                textDecoration: "underline",
                background: "none",
                border: 0,
                cursor: "pointer",
                color: "inherit",
                flexShrink: 0,
              }}
            >
              Dismiss
            </button>
          </StatusBanner>
        )}

        {picker && tokens && (
          <TokenPicker
            tokens={tokens}
            balances={balances}
            title={picker === "from" ? "You pay" : "You receive"}
            excludeAddress={picker === "from" ? toTok?.address : fromTok?.address}
            onSelect={pick}
            onClose={() => setPicker(null)}
          />
        )}
      </div>

      {/* DESK COMPARISON */}
      <div>
        <div className="desks-h">
          <div>
            <div className="eyebrow-sm">Net after all fees, slippage &amp; gas</div>
            <h2 style={{ fontSize: 24, marginTop: 5 }}>One swap, priced everywhere</h2>
          </div>
        </div>

        <DeskComparison
          data={data}
          loading={loadingQuotes}
          toTok={toTok}
          bestSource={bestSource}
          selectedSource={selectedSource}
          onSelect={(src) => setSelectedSource(src)}
          hasAmount={hasAmount}
        />

        <div className="desk-note">
          <svg width="15" height="15" viewBox="0 0 15 15" aria-hidden="true">
            <path
              d="M7.5 1l5 2.2v3.3c0 3.3-2.3 5-5 6.5-2.7-1.5-5-3.2-5-6.5V3.2z"
              stroke="var(--accent-2)"
              strokeWidth="1.3"
              fill="none"
            />
          </svg>
          <span>
            Every number is <strong>what actually lands in your wallet</strong> after that
            venue&apos;s fees, slippage, and network gas. Tap any quote to use that venue instead of
            our pick. CoW is shown for reference but never recommended; it is an intent a solver may
            or may not fill. Some regional FX stablecoins only trade on the FX provider; no public DEX pool
            exists for those corridors.
          </span>
        </div>
      </div>
    </section>
  );
}

// ─── sub-components ──────────────────────────────────────────────────────────

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
        marginTop: 12,
        border: "1px solid rgba(99,102,241,.3)",
        background: "rgba(99,102,241,.06)",
        color: "#3730a3",
        borderRadius: 11,
        padding: "10px 13px",
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
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "inherit", textDecoration: "underline", fontFamily: "var(--f-tech)" }}
        >
          {spenderShort}
        </a>
      </div>
      <div style={{ marginTop: 4, opacity: 0.65 }}>
        Revoke anytime at{" "}
        <a
          href="https://revoke.cash"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "inherit", textDecoration: "underline" }}
        >
          revoke.cash
        </a>
      </div>
    </div>
  );
}

function TokButton({ token, onClick }: { token: FxToken | null; onClick: () => void }) {
  return (
    <button type="button" className="tokbtn" onClick={onClick}>
      {token ? (
        <>
          <span className="fl">{currencyFlag(token.currency)}</span>
          {token.symbol}
          <span className="ca">▾</span>
        </>
      ) : (
        "…"
      )}
    </button>
  );
}

function DeskComparison({
  data,
  loading,
  toTok,
  bestSource,
  selectedSource,
  onSelect,
  hasAmount,
}: {
  data?: QuotesData;
  loading: boolean;
  toTok: FxToken | null;
  bestSource?: "fx-provider" | "lifi" | "kyber" | "cow";
  selectedSource: "fx-provider" | "lifi" | "kyber" | "cow" | null;
  onSelect: (src: "fx-provider" | "lifi" | "kyber" | "cow") => void;
  hasAmount: boolean;
}) {
  if (!hasAmount) {
    return (
      <div className="desks-empty">Enter an amount to compare FX Provider · LiFi · KyberSwap · CoW</div>
    );
  }
  if (loading && !data) {
    return (
      <div>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              height: 58,
              borderRadius: 14,
              border: "1px solid var(--line)",
              background: "var(--bg-soft)",
              marginBottom: 10,
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          />
        ))}
      </div>
    );
  }
  if (!data || !toTok) return null;

  return (
    <div>
      {ORDER.map((d) => {
        const result: QuoteResult = data[d];
        const isBest = !!bestSource && bestSource === d;
        // A desk is "selected" if the user clicked it explicitly.
        // When nothing is selected, the best desk also gets a selected style.
        const isSelected = selectedSource ? selectedSource === d : isBest;
        const ok = result.ok;
        const out = ok ? netHuman(result.quote, toTok.decimals) : 0;
        const tool = ok ? result.quote.toolName : "";
        const subline = ok ? deskSubline(result.quote) : "";
        const subTone = ok ? deskSublineTone(result.quote) : "slip";
        const detail = d !== "fx-provider" && ok && tool ? `via ${tool}` : DESK_DETAIL[d];

        if (!ok) {
          return (
            <div key={d} className="desk dead">
              <div className="L">
                <span className="nm">{DESK_LABEL[d]}</span>
                <span className="via">{detail}</span>
              </div>
              <div className="R">
                <span className="none">no route</span>
              </div>
            </div>
          );
        }
        return (
          <button
            key={d}
            type="button"
            className={`desk${isBest ? " best" : ""}${isSelected ? " selected" : ""}`}
            onClick={() => onSelect(d)}
            aria-pressed={isSelected}
            aria-label={`Use ${DESK_LABEL[d]} — ${fmt(out, 4)} ${toTok.symbol}`}
          >
            <div className="L">
              <span className="nm">
                {DESK_LABEL[d]}
                {isBest && <span className="bestpill">Best</span>}
              </span>
              <span className="via">{detail}</span>
            </div>
            <div className="R">
              <div className="out">
                {fmt(out, 4)} {toTok.symbol}
              </div>
              <div className={`sub ${subTone}`}>{subline}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function buttonLabel(
  status: ReturnType<typeof useSwap>["status"],
  hasAmount: boolean,
  loading: boolean,
  activeQuote: NormalizedQuote | undefined,
  activeSource: string | undefined,
  data?: QuotesData,
): string {
  if (status === "signing") return "Sign swap in wallet…";
  if (status === "signing_permit") return "Sign permit in wallet…";
  if (status === "approving") return "Approve token in wallet…";
  if (status === "submitting") return "Submitting…";
  if (status === "confirming") return "Confirming…";
  if (!hasAmount) return "Enter an amount";
  if (loading) return "Finding best rate…";
  if (activeQuote) {
    const label = activeSource === "fx-provider" ? "FX Provider" : (activeQuote.toolName ?? activeSource ?? "");
    return `Swap via ${label}`;
  }
  if (data && !data["fx-provider"].ok && !data.lifi.ok) return "No route for this pair";
  return "Enter an amount";
}

function NoRouteHelp({ fromTok, toTok }: { fromTok: FxToken | null; toTok: FxToken | null }) {
  const fromFxProvider = fromTok?.sources?.length === 1 && fromTok.sources[0] === "fx-provider";
  const toFxProvider = toTok?.sources?.length === 1 && toTok.sources[0] === "fx-provider";
  const fxOnly = fromFxProvider || toFxProvider;
  return (
    <div className="noroute">
      <b>No route for this pair</b>
      <p>
        {fxOnly ? (
          <>
            <strong style={{ color: "var(--ink-2)" }}>
              {fromFxProvider ? fromTok?.symbol : toTok?.symbol}
            </strong>{" "}
            is a regional stablecoin with no mainnet DEX pool, and there is no active maker
            liquidity for this pair right now. Pick a different pair, or browse what&apos;s live in
            Markets.
          </>
        ) : (
          <>
            None of the four desks found a route for this pair at the current size. Try a larger
            amount (gas can make small trades uneconomical), or browse what&apos;s live in Markets.
          </>
        )}
      </p>
    </div>
  );
}

function ConfirmSpinner() {
  return (
    <span
      style={{
        display: "inline-block",
        width: 12,
        height: 12,
        border: "2px solid currentColor",
        borderTopColor: "transparent",
        borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
        flexShrink: 0,
      }}
    />
  );
}

function StatusBanner({
  tone,
  children,
}: { tone: "success" | "error" | "pending" | "warn"; children: React.ReactNode }) {
  const style: React.CSSProperties =
    tone === "success"
      ? { borderColor: "rgba(19,185,129,.4)", background: "rgba(19,185,129,.08)", color: "#0a7a53" }
      : tone === "error"
        ? {
            borderColor: "rgba(240,67,106,.4)",
            background: "rgba(240,67,106,.08)",
            color: "#b61441",
          }
        : tone === "warn"
          ? {
              borderColor: "rgba(234,179,8,.5)",
              background: "rgba(234,179,8,.08)",
              color: "#854d0e",
            }
          : {
              borderColor: "rgba(99,102,241,.3)",
              background: "rgba(99,102,241,.06)",
              color: "#3730a3",
            };
  return (
    <div
      style={{
        marginTop: 12,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        border: "1px solid",
        borderRadius: 11,
        padding: "9px 12px",
        fontSize: 12,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Page-specific CSS transplanted verbatim from design-v2 swap.html, .ds4-scoped
 *  (design.css is frozen by Phase 0, so swap-page classes live here). */
function SwapStyles() {
  return (
    <style>{`
.ds4 .swrap{display:grid;grid-template-columns:minmax(0,460px) minmax(0,1fr);gap:30px;align-items:start;padding-top:38px;padding-bottom:60px}
@media(max-width:980px){.ds4 .swrap{grid-template-columns:1fr;gap:24px}}
.ds4 .swap{background:#fff;border:1px solid var(--line);border-radius:var(--r-lg);box-shadow:var(--sh-3);padding:22px}
.ds4 .swap-h{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:14px}
.ds4 .swap-h h2{font-family:var(--f-display);font-weight:800;letter-spacing:-.02em;color:var(--ink);font-size:24px;margin:0}
.ds4 .swap-h .faucet{font-family:var(--f-tech);font-size:11.5px;font-weight:700;color:var(--brand);background:var(--bg-tint);border:0;padding:6px 11px;border-radius:8px;cursor:pointer}
.ds4 .panel{background:var(--bg-soft);border:1px solid var(--line);border-radius:16px;padding:14px 15px}
.ds4 .panel .pl{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:12px;color:var(--muted);margin-bottom:9px}
.ds4 .panel .pl > span:first-child{white-space:nowrap}
.ds4 .panel .pl .max{font-family:var(--f-tech);font-size:11.5px;color:var(--brand);background:none;border:0;cursor:pointer;padding:0}
.ds4 .panel .prow{display:flex;align-items:center;gap:12px}
.ds4 .tokbtn{display:flex;align-items:center;gap:8px;flex:0 0 auto;background:#fff;border:1px solid var(--line-2);border-radius:12px;padding:9px 12px;font-family:var(--f-ui);font-weight:800;font-size:15px;color:var(--ink);cursor:pointer;transition:.15s}
.ds4 .tokbtn:hover{border-color:var(--brand)}
.ds4 .tokbtn .fl{font-size:18px;line-height:1}
.ds4 .tokbtn .ca{color:var(--muted-2);font-size:11px}
.ds4 .panel input{flex:1;min-width:0;border:0;background:none;text-align:right;font-family:var(--f-display);font-weight:800;font-size:30px;color:var(--ink);outline:none}
.ds4 .panel input::placeholder{color:var(--line-2)}
.ds4 .panel input:disabled{color:var(--ink)}
.ds4 .flipwrap{display:flex;justify-content:center;margin:-8px 0;position:relative;z-index:2}
.ds4 .flip{width:38px;height:38px;border-radius:11px;border:1px solid var(--line-2);background:#fff;color:var(--muted);cursor:pointer;box-shadow:var(--sh-1);transition:.15s;display:flex;align-items:center;justify-content:center;font-size:16px}
.ds4 .flip:hover{color:var(--brand);border-color:var(--brand);transform:rotate(180deg)}
.ds4 .brk{margin-top:12px;border:1px solid var(--line);border-radius:13px;padding:11px 13px;background:#fff}
.ds4 .brk .r{display:flex;justify-content:space-between;gap:14px;font-size:12px;padding:3px 0}
.ds4 .brk .r .k{color:var(--muted);white-space:nowrap}
.ds4 .brk .r .v{font-family:var(--f-tech);font-weight:600;color:var(--ink-2);white-space:nowrap;text-align:right}
.ds4 .brk .cow{margin-top:8px;background:#fff7ed;border:1px solid #fed7aa;color:#9a4f12;border-radius:9px;padding:8px 10px;font-size:11px;line-height:1.5}
.ds4 .swapbtn{width:100%;margin-top:14px;padding:14px;border-radius:13px;border:0;cursor:pointer;font-family:var(--f-ui);font-weight:800;font-size:15px;background:var(--grad-brand);color:#fff;box-shadow:var(--sh-brand);transition:.15s}
.ds4 .swapbtn:hover{box-shadow:0 18px 44px rgba(37,99,235,.34)}
.ds4 .swapbtn:disabled{opacity:.5;cursor:not-allowed;box-shadow:none;background:var(--line-2)}
.ds4 .noroute{margin-top:12px;border:1px solid #fed7aa;background:#fff7ed;border-radius:13px;padding:13px}
.ds4 .noroute b{display:block;font-size:13px;color:#9a4f12;margin-bottom:4px}
.ds4 .noroute p{margin:0;font-size:12px;color:var(--muted);line-height:1.5}
.ds4 .noroute a{color:var(--brand);font-weight:700}
.ds4 .desks-h{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:14px}
.ds4 .desks-h h2{font-family:var(--f-display);font-weight:800;letter-spacing:-.02em;color:var(--ink);margin:0}
.ds4 .eyebrow-sm{font-family:var(--f-tech);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted-2)}
.ds4 .desk{display:flex;align-items:center;justify-content:space-between;gap:14px;border:1px solid var(--line);border-radius:14px;padding:15px 17px;margin-bottom:10px;background:#fff;transition:.15s;cursor:pointer;width:100%;font:inherit;text-align:left}
.ds4 .desk:hover{border-color:var(--brand);box-shadow:var(--sh-1)}
.ds4 .desk.best{border-color:var(--brand);box-shadow:0 0 0 1px var(--brand) inset, var(--sh-2);background:linear-gradient(180deg,#fff,var(--bg-tint))}
.ds4 .desk.selected{border-color:var(--brand);box-shadow:0 0 0 2px var(--brand) inset, var(--sh-2);background:linear-gradient(180deg,#fff,var(--bg-tint))}
.ds4 .desk.dead{opacity:.62;cursor:default}
.ds4 .desk.dead:hover{border-color:var(--line);box-shadow:none}
.ds4 .desk .L{display:flex;align-items:center;gap:11px;min-width:0}
.ds4 .desk .nm{font-family:var(--f-display);font-weight:800;font-size:16px;display:flex;align-items:center;gap:9px;white-space:nowrap}
.ds4 .desk .via{font-family:var(--f-tech);font-size:11px;color:var(--muted-2);white-space:nowrap}
.ds4 .desk .bestpill{font-family:var(--f-tech);font-size:9.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#fff;background:var(--grad-brand);padding:3px 7px;border-radius:6px}
.ds4 .desk .R{text-align:right;flex:0 0 auto}
.ds4 .desk .out{font-family:var(--f-tech);font-weight:700;font-size:16px;color:var(--ink);white-space:nowrap}
.ds4 .desk .sub{font-size:10.5px;margin-top:2px;white-space:nowrap}
.ds4 .desk .sub.ok{color:var(--yes)}
.ds4 .desk .sub.slip{color:var(--muted-2)}
.ds4 .desk .none{font-family:var(--f-tech);font-size:12px;color:var(--muted-2)}
.ds4 .desk-note{font-size:11.5px;color:var(--muted);line-height:1.6;margin-top:14px;display:flex;gap:9px}
.ds4 .desk-note svg{flex:0 0 auto;margin-top:2px}
.ds4 .desks-empty{border:1px dashed var(--line-2);border-radius:14px;padding:40px 20px;text-align:center;color:var(--muted-2);font-size:13px}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
`}</style>
  );
}
