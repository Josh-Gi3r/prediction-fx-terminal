"use client";

import { FundWalletModal } from "@/components/wc/FundWalletModal";
import { PM_BETTING_ENABLED } from "@/lib/polymarket/config";
import { getContractConfig } from "@/lib/polymarket/order";
import { useBet } from "@/lib/polymarket/useBet";
import { PM_MIN_SIZE, useBetEconomics } from "@/lib/polymarket/useBetEconomics";
import { useDeriveCreds } from "@/lib/polymarket/useDeriveCreds";
import { useUsdcApproval } from "@/lib/polymarket/useUsdcApproval";
import type { WcLiveMarket } from "@/lib/wc2026/usePm";
import { useWallets } from "@privy-io/react-auth";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createWalletClient, custom } from "viem";
import type { WalletClient } from "viem";
import { polygon } from "wagmi/chains";
import { Icon } from "./Icon";

/**
 * BetSlip — mobile bet entry sheet.
 *
 * Input UX: user types a USDC dollar amount (keypad).
 * Bet math: all economics (limitPrice, size, costRaw, payout, profit) are
 * computed by useBetEconomics("usdc", ...) — the single source of truth shared
 * with the desktop BetSheet surface.
 *
 * On-chain behaviour is identical to BetSheet for the same economic intent:
 *   - Same limitPrice (tick-snapped, same derivePrice logic)
 *   - Same canonical size (floor(dollars/price), min-clamped once)
 *   - Same costRaw = usdcToRaw(limitPrice * size) — NOT the raw dollar input
 *   - Same values passed to placeBet() and useUsdcApproval()
 */

export interface SlipMarket {
  q: string;
  tag?: string;
  yesL?: string;
  noL?: string;
  yes: number;
  no: number;
  pick?: "yes" | "no";
  /** Present when this slip maps to a real live market -- enables real execution. */
  live?: WcLiveMarket;
}

interface BetSlipProps {
  market: SlipMarket | null;
  open: boolean;
  onClose: () => void;
  onPlaced?: () => void;
}

function fmtRawUsdc(raw: bigint | null): string {
  if (raw === null) return "...";
  return `$${(Number(raw) / 1e6).toFixed(2)}`;
}

export function BetSlip({ market, open, onClose, onPlaced }: BetSlipProps) {
  const [pick, setPick] = useState<"yes" | "no">("yes");
  const [fundOpen, setFundOpen] = useState(false);
  const [amount, setAmount] = useState("25");

  const { wallets } = useWallets();

  // Real execution hooks -- always called (hooks rules), only used when live is present.
  const { creds, derive, pending: credsPending, error: credsError, ready } = useDeriveCreds();
  const { bet, placeBet, reset: resetBet } = useBet();

  // Build walletClient for the approval hook
  const [walletClient, setWalletClient] = useState<WalletClient | null>(null);
  useEffect(() => {
    const wallet = wallets[0];
    if (!wallet) {
      setWalletClient(null);
      return;
    }
    let cancelled = false;
    wallet.getEthereumProvider().then((provider) => {
      if (cancelled) return;
      setWalletClient(
        createWalletClient({
          chain: polygon,
          transport: custom(provider),
          account: wallet.address as `0x${string}`,
        }),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [wallets]);

  useEffect(() => {
    if (open) {
      setPick(market?.pick ?? "yes");
      setAmount("25");
      resetBet();
    }
  }, [open, market, resetBet]);

  // Reset bet state when market key or pick changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional change-trigger
  useEffect(() => {
    resetBet();
  }, [market?.live?.key, pick, resetBet]);

  // NOTE: all hooks must run before any early return -- `market` toggles
  // null -> object when a slip opens, so an early `return null` placed between
  // hook groups changes the hook count between renders (React error #310).

  const live = market?.live ?? null;
  const isLive = live !== null;
  const amt = Number.parseFloat(amount) || 0;

  // useBetEconomics requires a BetMarketParams. When there is no live market,
  // supply a synthetic params object so the hook can still run unconditionally.
  // The result is used only for display in preview mode (not for real execution).
  const yesPx = market?.yes ?? 0;
  const noPx = market?.no ?? 0;

  const marketParams = useMemo(() => {
    if (live) return live;
    // Synthetic params from preview data (cents → 0-1 fraction)
    return {
      yesPrice: yesPx / 100,
      noPrice: noPx / 100,
      bestBid: null,
      tickSize: 0.01,
      minOrderSize: PM_MIN_SIZE,
      negRisk: false,
    };
  }, [live, yesPx, noPx]);

  // All bet math flows through useBetEconomics -- single source of truth.
  // BetSlip collects USDC dollars, so inputUnit is "usdc".
  const econ = useBetEconomics("usdc", amt, pick, marketParams);

  const minSize = Math.max(PM_MIN_SIZE, marketParams.minOrderSize);

  // USDC.e approval -- costRaw comes from econ (derived from limitPrice*size),
  // NOT from the raw dollar input `amt`. This matches BetSheet exactly.
  const contracts = getContractConfig(137);
  const spender = (
    (live?.negRisk ?? false) ? contracts.negRiskExchange : contracts.exchange
  ) as `0x${string}`;

  const usdcApproval = useUsdcApproval(walletClient, spender, econ.costRaw, null);

  // Refresh allowance when opened or cost changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional
  useEffect(() => {
    if (walletClient && isLive && open) {
      usdcApproval.refresh();
    }
  }, [walletClient, isLive, open, econ.costRaw.toString()]);

  const insufficientBalance =
    isLive && usdcApproval.balance !== null && usdcApproval.balance < econ.costRaw;

  const pressKey = (k: string) => {
    setAmount((prev) => {
      if (k === "del") return prev.length <= 1 ? "0" : prev.slice(0, -1);
      if (k === ".") return prev.includes(".") ? prev : `${prev}.`;
      if (prev === "0") return k;
      if (prev.length >= 6) return prev;
      return prev + k;
    });
  };

  const fmt = (n: number) =>
    `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Real execution handlers
  const handleDeriveCreds = useCallback(async () => {
    try {
      await derive();
    } catch {
      // error shown via credsError
    }
  }, [derive]);

  const handleApprove = useCallback(async () => {
    await usdcApproval.approve();
  }, [usdcApproval]);

  const handleBet = useCallback(async () => {
    if (!creds || !live) return;
    // econ.limitPrice and econ.size are the canonical on-chain values --
    // identical to what BetSheet would produce for the same economic intent.
    await placeBet({
      marketKey: live.key,
      side: pick,
      price: econ.limitPrice,
      size: econ.size,
      creds,
    });
  }, [creds, live, placeBet, pick, econ.limitPrice, econ.size]);

  // Safe to bail now -- every hook above has run unconditionally.
  if (!market) return null;

  const isBusy =
    bet.status === "building" ||
    bet.status === "checking-allowance" ||
    bet.status === "approving" ||
    bet.status === "signing" ||
    bet.status === "submitting" ||
    bet.status === "polling";

  const isFilled = bet.status === "filled";
  const isCancelled = bet.status === "cancelled";
  const isOpen = bet.status === "open" || bet.status === "pending" || bet.status === "unconfirmed";
  const isError = bet.status === "error";
  const isDone = isFilled || isCancelled || isOpen;

  const pickLabel = pick === "yes" ? (market.yesL ?? "YES") : (market.noL ?? "NO");

  // Filled state
  if (isLive && isFilled) {
    return (
      <>
        <div className={`sheet-scrim${open ? " open" : ""}`} onClick={onClose} />
        <div className={`sheet${open ? " open" : ""}`}>
          <div className="grab" />
          <div className="sbody">
            <div className="confirm fade-in">
              <div className="cmark">
                <Icon name="check" size={34} color="#06291f" stroke={3} />
              </div>
              <h3>Position placed</h3>
              <p>
                Your {pickLabel} order is live. Winnings settle onchain to your wallet if the market
                resolves in your favor.
              </p>
              {bet.orderId && (
                <div
                  style={{
                    fontFamily: "var(--f-tech)",
                    fontSize: 11,
                    color: "var(--muted-2)",
                    marginBottom: 12,
                    textAlign: "center",
                  }}
                >
                  Order: {bet.orderId.slice(0, 16)}...
                </div>
              )}
              <div className="crecap">
                <div className="pr">
                  <span>Market</span>
                  <span className="v" style={{ maxWidth: 180, textAlign: "right" }}>
                    {market.q}
                  </span>
                </div>
                <div className="pr">
                  <span>Side</span>
                  <span
                    className="v"
                    style={{ color: pick === "yes" ? "var(--yes)" : "var(--no)" }}
                  >
                    {pickLabel} @ {Math.round(econ.limitPrice * 100)}c
                  </span>
                </div>
                <div className="pr">
                  <span>Stake</span>
                  <span className="v">{econ.displayCost}</span>
                </div>
                <div className="pr">
                  <span>Shares</span>
                  <span className="v">{econ.size}</span>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-primary btn-block btn-lg"
                onClick={() => {
                  onPlaced?.();
                  onClose();
                }}
              >
                Done
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-block"
                style={{ marginTop: 10 }}
                onClick={() => resetBet()}
              >
                Place another
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Open/pending/unconfirmed state
  if (isLive && isOpen) {
    return (
      <>
        <div className={`sheet-scrim${open ? " open" : ""}`} onClick={onClose} />
        <div className={`sheet${open ? " open" : ""}`}>
          <div className="grab" />
          <div className="sbody">
            <div
              style={{
                background: "var(--bg-soft)",
                border: "1px solid var(--brand)",
                borderRadius: "var(--r)",
                padding: "16px 18px",
                textAlign: "center",
                marginBottom: 14,
              }}
            >
              <div
                style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, color: "var(--brand)" }}
              >
                {bet.status === "unconfirmed" ? "Unconfirmed" : "Order submitted"}
              </div>
              <p style={{ margin: 0, color: "var(--muted)", fontSize: 13, lineHeight: 1.5 }}>
                {bet.status === "unconfirmed"
                  ? "Fill confirmation timed out. Check your positions to verify."
                  : "Your order is on the book. It will fill when a match is found."}
              </p>
              {bet.orderId && (
                <div
                  style={{
                    fontFamily: "var(--f-tech)",
                    fontSize: 11,
                    color: "var(--muted-2)",
                    marginTop: 8,
                  }}
                >
                  Order: {bet.orderId.slice(0, 16)}...{" "}
                  <a
                    href="https://polymarket.com/activity"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "var(--brand)" }}
                  >
                    Check positions
                  </a>
                </div>
              )}
            </div>
            <button type="button" className="btn btn-primary btn-block btn-lg" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className={`sheet-scrim${open ? " open" : ""}`} onClick={onClose} />
      <div className={`sheet${open ? " open" : ""}`}>
        <div className="grab" />
        <div className="sbody">
          {/* Cancelled banner */}
          {isLive && isCancelled && (
            <div
              style={{
                background: "var(--bg-soft)",
                border: "1px solid var(--line)",
                borderRadius: "var(--r)",
                padding: "12px 14px",
                marginBottom: 14,
                textAlign: "center",
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 4, color: "var(--muted)" }}>
                Order not filled
              </div>
              <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--muted)" }}>
                No matching offer at your price. Try again or adjust your amount.
              </p>
              <button
                type="button"
                className="btn btn-block"
                style={{ borderColor: "var(--line)" }}
                onClick={() => resetBet()}
              >
                Try again
              </button>
            </div>
          )}

          {/* Error banner */}
          {isLive && isError && (
            <div
              style={{
                background: "var(--no-soft)",
                border: "1px solid var(--no)",
                borderRadius: "var(--r)",
                padding: "12px 14px",
                marginBottom: 14,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--no)", marginBottom: 4 }}>
                Error
              </div>
              <p
                style={{ margin: "0 0 8px", fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}
              >
                {bet.error}
              </p>
              <button
                type="button"
                className="btn btn-block"
                style={{ borderColor: "var(--line)" }}
                onClick={() => resetBet()}
              >
                Try again
              </button>
            </div>
          )}

          {!isDone && (
            <>
              <div className="slip-head">
                <div style={{ flex: 1 }}>
                  <div className="eyebrow" style={{ marginBottom: 6 }}>
                    <span className="tick" />
                    {market.tag ?? "Prediction market"}
                  </div>
                  <div className="slip-q">{market.q}</div>
                </div>
                <button
                  className="iconbtn"
                  onClick={onClose}
                  aria-label="Close bet slip"
                  type="button"
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                    <path
                      d="M4 4l10 10M14 4L4 14"
                      stroke="var(--muted)"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>

              <div className="slip-pick">
                <button
                  type="button"
                  className={`yes${pick === "yes" ? " sel" : ""}`}
                  onClick={() => setPick("yes")}
                  disabled={isBusy}
                >
                  <span className="pk-l">{market.yesL ?? "YES"}</span>
                  <span className="pk-v">{yesPx}c</span>
                  <span className="pk-s">{yesPx}% implied</span>
                </button>
                <button
                  type="button"
                  className={`no${pick === "no" ? " sel" : ""}`}
                  onClick={() => setPick("no")}
                  disabled={isBusy}
                >
                  <span className="pk-l">{market.noL ?? "NO"}</span>
                  <span className="pk-v">{noPx}c</span>
                  <span className="pk-s">{noPx}% implied</span>
                </button>
              </div>

              <div className="amt">
                <div className="al">Amount · USDC.e</div>
                <div className="ain">
                  <span className="cur">$</span>
                  <input value={amount} readOnly inputMode="none" />
                </div>
              </div>

              <div className="quickamt">
                {["10", "25", "100", "500"].map((v) => (
                  <button type="button" key={v} onClick={() => setAmount(v)} disabled={isBusy}>
                    ${v}
                  </button>
                ))}
              </div>

              <div className="payout">
                <div className="pr">
                  <span>Avg price</span>
                  <span className="v">{Math.round(econ.limitPrice * 100)}c</span>
                </div>
                <div className="pr">
                  <span>Shares</span>
                  <span className="v">{econ.displayShares}</span>
                </div>
                <div className="pr">
                  <span>Potential profit</span>
                  <span className="v up">{fmt(econ.profit)}</span>
                </div>
                {isLive && (
                  <div className="pr">
                    <span>USDC.e available</span>
                    <span
                      className="v"
                      style={{ color: insufficientBalance ? "var(--no)" : undefined }}
                    >
                      {fmtRawUsdc(usdcApproval.balance)}
                    </span>
                  </div>
                )}
                <div className="pr big">
                  <span className="lbl">
                    Payout if {pick === "yes" ? (market.yesL ?? "YES") : (market.noL ?? "NO")}
                  </span>
                  <span className="v">{fmt(econ.payout)}</span>
                </div>
              </div>

              <div className="keypad">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "del"].map((k) => (
                  <button type="button" key={k} onClick={() => pressKey(k)} disabled={isBusy}>
                    {k === "del" ? <Icon name="back" size={20} color="var(--muted)" /> : k}
                  </button>
                ))}
              </div>

              {/* Live execution path */}
              {isLive &&
                (PM_BETTING_ENABLED ? (
                  <>
                    {/* Insufficient balance */}
                    {insufficientBalance && (
                      <p
                        style={{
                          margin: "0 0 8px",
                          fontSize: 12,
                          color: "var(--no)",
                          textAlign: "center",
                        }}
                      >
                        Insufficient USDC.e on Polygon.{" "}
                        <button
                          type="button"
                          onClick={() => setFundOpen(true)}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: "var(--brand)",
                            padding: 0,
                            fontSize: "inherit",
                          }}
                        >
                          Fund your wallet
                        </button>
                      </p>
                    )}

                    {/* Wallet not connected */}
                    {!ready && (
                      <button
                        type="button"
                        className="btn btn-primary btn-block btn-lg"
                        disabled
                        style={{ opacity: 0.5 }}
                      >
                        Connect wallet to trade
                      </button>
                    )}

                    {/* Wallet connected, no creds yet */}
                    {ready && !creds && bet.status === "idle" && (
                      <div
                        style={{
                          background: "var(--bg-tint)",
                          border: "1px solid var(--line-2)",
                          borderRadius: "var(--r)",
                          padding: "12px 14px",
                        }}
                      >
                        <p
                          style={{
                            margin: "0 0 10px",
                            fontSize: 13,
                            color: "var(--muted)",
                            lineHeight: 1.55,
                          }}
                        >
                          One-time wallet signature required to enable trading. Free. No funds are
                          moved.
                        </p>
                        {credsError && (
                          <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--no)" }}>
                            {credsError}
                          </p>
                        )}
                        <button
                          type="button"
                          className="btn btn-primary btn-block btn-lg"
                          onClick={handleDeriveCreds}
                          disabled={credsPending}
                          style={{ opacity: credsPending ? 0.65 : 1 }}
                        >
                          {credsPending ? "Signing..." : "Authorize trading account"}
                        </button>
                      </div>
                    )}

                    {/* USDC.e approval */}
                    {ready &&
                      creds &&
                      usdcApproval.needsApproval &&
                      !insufficientBalance &&
                      !isBusy && (
                        <div>
                          {usdcApproval.error && (
                            <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--no)" }}>
                              {usdcApproval.error}
                            </p>
                          )}
                          <button
                            type="button"
                            className="btn btn-primary btn-block btn-lg"
                            onClick={handleApprove}
                            disabled={usdcApproval.approving}
                            style={{ opacity: usdcApproval.approving ? 0.65 : 1 }}
                          >
                            {usdcApproval.approving
                              ? "Approving..."
                              : `Approve ${econ.displayCost} USDC.e`}
                          </button>
                        </div>
                      )}

                    {/* In-flight status */}
                    {isBusy && (
                      <div
                        style={{
                          background: "var(--bg-soft)",
                          borderRadius: "var(--r)",
                          padding: "12px 14px",
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: "50%",
                            background: "var(--brand)",
                            animation: "pulse 1.2s infinite",
                            display: "inline-block",
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ fontSize: 13, color: "var(--muted)" }}>
                          {bet.status === "building" && "Building order..."}
                          {bet.status === "checking-allowance" && "Checking USDC.e allowance..."}
                          {bet.status === "approving" && "Approving USDC.e..."}
                          {bet.status === "signing" && "Waiting for wallet signature..."}
                          {bet.status === "submitting" && "Submitting order..."}
                          {bet.status === "polling" && "Waiting for fill confirmation..."}
                        </span>
                      </div>
                    )}

                    {/* Ready to bet -- gate on allowanceKnown so we never fire with
                        an unread allowance. needsApproval is false while loading,
                        which would otherwise falsely unblock this button. */}
                    {ready &&
                      creds &&
                      !isBusy &&
                      usdcApproval.allowanceKnown &&
                      !usdcApproval.needsApproval && (
                        <button
                          type="button"
                          className="btn btn-primary btn-block btn-lg"
                          onClick={handleBet}
                          disabled={amt <= 0 || econ.size < minSize || insufficientBalance}
                          style={{
                            opacity:
                              amt <= 0 || econ.size < minSize || insufficientBalance ? 0.5 : 1,
                          }}
                        >
                          Place {pickLabel} · {econ.displayCost}
                        </button>
                      )}
                  </>
                ) : (
                  /* View-only panel */
                  <div
                    style={{
                      background: "var(--bg-soft)",
                      border: "1px solid var(--line)",
                      borderRadius: "var(--r)",
                      padding: "14px 16px",
                      textAlign: "center",
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontSize: 13,
                        color: "var(--muted)",
                        lineHeight: 1.6,
                      }}
                    >
                      Betting opens soon. Markets are live and view-only while we finish wiring real
                      settlement.
                    </p>
                  </div>
                ))}

              {/* Preview-only path (no live market attached) */}
              {!isLive && (
                <button
                  type="button"
                  className="btn btn-primary btn-block btn-lg"
                  disabled
                  style={{ opacity: 0.5 }}
                  title="Open the market page to place a real bet"
                >
                  Preview · see market page
                </button>
              )}

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 7,
                  marginTop: 12,
                  color: "var(--muted-2)",
                  fontSize: 11.5,
                }}
              >
                <Icon name="fx-provider" size={14} color="var(--muted-2)" /> Settled onchain · 18+ only
              </div>
            </>
          )}
        </div>
      </div>
      <FundWalletModal
        open={fundOpen}
        onClose={() => setFundOpen(false)}
        suggestedAmount={econ.cost > 0 ? Math.ceil(econ.cost) : undefined}
      />
    </>
  );
}
