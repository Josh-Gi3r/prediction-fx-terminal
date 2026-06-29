"use client";

/**
 * BetSheet — slide-up panel for placing a YES/NO prediction on a WC market.
 *
 * Design rules (DESIGN_MIGRATION.md):
 * - No fake success. Shows actual status at every step.
 * - Honest pending states: "Signing..." / "Submitting..." / "Waiting for fill..."
 * - Price the user accepts is always shown (no hidden slippage surprise).
 * - Chain switching is handled transparently.
 * - USDC.e balance and allowance shown; approve button when needed.
 *
 * States (flag-ON path):
 * idle -> checking-allowance -> approving? -> building -> signing -> submitting
 *   -> filled | open | pending | unconfirmed | cancelled | error
 *
 * Cred flow: if user has no PM creds yet, BetSheet prompts a one-time
 * "Authorize Polymarket" signature before the first bet. Subsequent bets
 * in the same session reuse in-memory creds.
 *
 * Collateral: USDC.e (bridged USDC) on Polygon only. Native USDC will not
 * work with Polymarket's CTF Exchange.
 *
 * Bet math: all economics (limitPrice, size, costRaw, payout, profit) are
 * computed by useBetEconomics -- the single source of truth shared with the
 * mobile BetSlip surface.  This guarantees identical on-chain order size and
 * approval amount for the same economic intent on both surfaces.
 */

import { PM_BETTING_ENABLED } from "@/lib/polymarket/config";
import { getContractConfig } from "@/lib/polymarket/order";
import { useBet } from "@/lib/polymarket/useBet";
import { PM_MIN_SIZE, useBetEconomics } from "@/lib/polymarket/useBetEconomics";
import { useDeriveCreds } from "@/lib/polymarket/useDeriveCreds";
import { useUsdcApproval } from "@/lib/polymarket/useUsdcApproval";
import type { WcLiveMarket } from "@/lib/wc2026/usePm";
import { useWallets } from "@privy-io/react-auth";
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createWalletClient, custom } from "viem";
import type { WalletClient } from "viem";
import { polygon } from "wagmi/chains";
import { FundWalletModal } from "./FundWalletModal";

interface BetSheetProps {
  market: WcLiveMarket & { key: string };
  initialSide: "yes" | "no";
  onClose: () => void;
}

function fmtCents(price: number): string {
  return `${(price * 100).toFixed(price < 0.01 ? 1 : 0)}c`;
}

function fmtRawUsdc(raw: bigint | null): string {
  if (raw === null) return "...";
  return `$${(Number(raw) / 1e6).toFixed(2)}`;
}

export function BetSheet({ market, initialSide, onClose }: BetSheetProps) {
  const [side, setSide] = useState<"yes" | "no">(initialSide);
  const [fundOpen, setFundOpen] = useState(false);
  const [sizeStr, setSizeStr] = useState(String(Math.max(PM_MIN_SIZE, market.minOrderSize)));
  const [customPriceStr, setCustomPriceStr] = useState("");

  const { wallets } = useWallets();
  const { creds, derive, pending: credsPending, error: credsError } = useDeriveCreds();
  const { bet, placeBet, reset } = useBet();

  // Build a walletClient for the approval hook (needs viem WalletClient, not Privy wallet)
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

  // Parse user inputs
  const rawSize = useMemo(() => {
    const n = Number.parseFloat(sizeStr);
    return Number.isNaN(n) ? 0 : n;
  }, [sizeStr]);

  const customPrice = useMemo(() => {
    const p = Number.parseFloat(customPriceStr);
    return !Number.isNaN(p) && p > 0 && p < 1 ? p : undefined;
  }, [customPriceStr]);

  // All bet math flows through useBetEconomics -- single source of truth.
  // BetSheet collects SHARES, so inputUnit is "shares".
  const econ = useBetEconomics("shares", rawSize, side, market, customPrice);

  const minSize = Math.max(PM_MIN_SIZE, market.minOrderSize);

  // USDC.e approval -- costRaw comes from econ, not from a locally computed cost.
  const contracts = getContractConfig(137);
  const spender = (
    market.negRisk ? contracts.negRiskExchange : contracts.exchange
  ) as `0x${string}`;

  const usdcApproval = useUsdcApproval(walletClient, spender, econ.costRaw, null);

  // Refresh allowance when the component mounts or cost changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: usdcApproval.refresh is stable; econ.costRaw.toString() is the real dep
  useEffect(() => {
    if (walletClient) {
      usdcApproval.refresh();
    }
  }, [walletClient, econ.costRaw.toString()]);

  const insufficientBalance = usdcApproval.balance !== null && usdcApproval.balance < econ.costRaw;

  // Gate canBet on allowanceKnown: while the on-chain allowance read is in
  // flight (allowance===null), needsApproval is false but the allowance is
  // unknown -- we must not unblock the bet button in that window.
  const canBet =
    creds &&
    bet.status === "idle" &&
    econ.size >= minSize &&
    econ.limitPrice > 0 &&
    econ.limitPrice < 1 &&
    !insufficientBalance &&
    usdcApproval.allowanceKnown &&
    !usdcApproval.needsApproval;

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
    if (!creds) return;
    // econ.limitPrice and econ.size are the canonical on-chain values.
    await placeBet({
      marketKey: market.key,
      side,
      price: econ.limitPrice,
      size: econ.size,
      creds,
    });
  }, [creds, placeBet, market.key, side, econ.limitPrice, econ.size]);

  // Reset on market/side change
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional change-trigger pattern
  useEffect(() => {
    reset();
  }, [market.key, side, reset]);

  const isBusy =
    bet.status === "building" ||
    bet.status === "checking-allowance" ||
    bet.status === "approving" ||
    bet.status === "signing" ||
    bet.status === "submitting" ||
    bet.status === "polling";

  const isDone =
    bet.status === "filled" ||
    bet.status === "open" ||
    bet.status === "pending" ||
    bet.status === "unconfirmed" ||
    bet.status === "cancelled";

  return (
    <>
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 200,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          background: "rgba(0,0,0,0.45)",
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
      >
        {/* biome-ignore lint/a11y/useSemanticElements: sheet needs div for border-radius styling */}
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Bet on ${market.question}`}
          style={{
            background: "var(--bg)",
            borderRadius: "var(--r-xl) var(--r-xl) 0 0",
            boxShadow: "var(--sh-3)",
            width: "100%",
            maxWidth: 520,
            padding: "28px 24px 36px",
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontFamily: "var(--f-tech)",
                  fontSize: 10,
                  letterSpacing: ".12em",
                  textTransform: "uppercase",
                  color: "var(--muted-2)",
                  marginBottom: 4,
                }}
              >
                {market.category} · live market
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: 15,
                  fontWeight: 700,
                  lineHeight: 1.4,
                  color: "var(--ink)",
                }}
              >
                {market.question}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close bet sheet"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--muted)",
                fontSize: 22,
                lineHeight: 1,
                padding: 2,
                flexShrink: 0,
              }}
            >
              x
            </button>
          </div>

          {/* Filled state */}
          {bet.status === "filled" && (
            <div
              style={{
                background: "var(--yes-soft)",
                border: "1px solid var(--yes)",
                borderRadius: "var(--r)",
                padding: "16px 18px",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 22, marginBottom: 6 }}>Order filled</div>
              <p style={{ margin: 0, color: "var(--muted)", fontSize: 13, lineHeight: 1.6 }}>
                Your {side.toUpperCase()} position is live. Winnings settle onchain to your Polygon
                wallet if the market resolves in your favor. This app is never in the payout path.
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
                  Order: {bet.orderId.slice(0, 16)}...
                </div>
              )}
              <button
                type="button"
                className="btn btn-primary"
                style={{ marginTop: 14, width: "100%" }}
                onClick={onClose}
              >
                Done
              </button>
            </div>
          )}

          {/* Open/pending/unconfirmed state (amber) */}
          {(bet.status === "open" || bet.status === "pending" || bet.status === "unconfirmed") && (
            <div
              style={{
                background: "var(--bg-soft)",
                border: "1px solid var(--brand)",
                borderRadius: "var(--r)",
                padding: "16px 18px",
                textAlign: "center",
              }}
            >
              <div
                style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, color: "var(--brand)" }}
              >
                {bet.status === "open" ? "Order resting" : "Order submitted"}
              </div>
              <p style={{ margin: 0, color: "var(--muted)", fontSize: 13, lineHeight: 1.6 }}>
                {bet.status === "unconfirmed"
                  ? "Order was submitted but fill confirmation timed out. Check your positions to verify."
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
              <button
                type="button"
                className="btn"
                style={{ marginTop: 14, width: "100%", borderColor: "var(--line)" }}
                onClick={onClose}
              >
                Close
              </button>
            </div>
          )}

          {/* Cancelled state */}
          {bet.status === "cancelled" && (
            <div
              style={{
                background: "var(--bg-soft)",
                border: "1px solid var(--line)",
                borderRadius: "var(--r)",
                padding: "16px 18px",
                textAlign: "center",
              }}
            >
              <div
                style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, color: "var(--muted)" }}
              >
                Order not filled
              </div>
              <p style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>
                No matching offer at your price. Try a higher limit.
              </p>
              <button
                type="button"
                className="btn"
                style={{ marginTop: 14, width: "100%", borderColor: "var(--line)" }}
                onClick={reset}
              >
                Try again
              </button>
            </div>
          )}

          {/* Error state */}
          {bet.status === "error" && (
            <div
              style={{
                background: "var(--no-soft)",
                border: "1px solid var(--no)",
                borderRadius: "var(--r)",
                padding: "14px 16px",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--no)", marginBottom: 4 }}>
                Error
              </div>
              <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
                {bet.error}
              </p>
              <button
                type="button"
                className="btn"
                style={{ marginTop: 12, borderColor: "var(--line)" }}
                onClick={reset}
              >
                Try again
              </button>
            </div>
          )}

          {/* Main form -- hidden when done */}
          {!isDone && (
            <>
              {/* Side toggle */}
              <div style={{ display: "flex", gap: 8 }}>
                {(["yes", "no"] as const).map((s) => {
                  const effectiveBase = market.yesPrice ?? market.bestBid ?? 0.5;
                  return (
                    <button
                      key={s}
                      type="button"
                      disabled={isBusy}
                      onClick={() => setSide(s)}
                      style={{
                        flex: 1,
                        padding: "10px 0",
                        borderRadius: "var(--r)",
                        border: `1.5px solid ${s === "yes" ? "var(--yes)" : "var(--no)"}`,
                        background:
                          side === s ? (s === "yes" ? "var(--yes)" : "var(--no)") : "var(--bg)",
                        color: side === s ? "#fff" : s === "yes" ? "var(--yes)" : "var(--no)",
                        fontWeight: 700,
                        fontSize: 14,
                        cursor: isBusy ? "not-allowed" : "pointer",
                        transition: "all 0.15s",
                      }}
                      aria-pressed={side === s}
                    >
                      {s.toUpperCase()}{" "}
                      <span
                        style={{
                          fontSize: 11,
                          fontFamily: "var(--f-tech)",
                          opacity: 0.85,
                        }}
                      >
                        {s === "yes"
                          ? fmtCents(market.yesPrice ?? effectiveBase)
                          : fmtCents(market.noPrice ?? 1 - effectiveBase)}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Order summary (view-only info) */}
              <div
                style={{
                  background: "var(--bg-soft)",
                  borderRadius: "var(--r)",
                  border: "1px solid var(--line)",
                  padding: "12px 14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                {[
                  [
                    "Current price",
                    `${fmtCents(econ.limitPrice)} (${side === "yes" ? "YES" : "NO"})`,
                  ],
                  ["Min order size", `${minSize} shares`],
                  ["Settled onchain", "Polygon wallet (self-custodial)"],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    style={{ display: "flex", justifyContent: "space-between", gap: 8 }}
                  >
                    <span style={{ fontSize: 12, color: "var(--muted)", flexShrink: 0 }}>
                      {label}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        fontFamily: "var(--f-tech)",
                        fontWeight: 700,
                        color: "var(--ink)",
                        textAlign: "right",
                      }}
                    >
                      {value}
                    </span>
                  </div>
                ))}
              </div>

              {/* Betting gate */}
              {PM_BETTING_ENABLED ? (
                <>
                  {/* Size input */}
                  <div>
                    <div
                      style={{
                        fontFamily: "var(--f-tech)",
                        fontSize: 10,
                        color: "var(--muted-2)",
                        letterSpacing: ".1em",
                        textTransform: "uppercase",
                        marginBottom: 6,
                      }}
                    >
                      Shares (min {minSize})
                    </div>
                    <input
                      type="number"
                      min={minSize}
                      step="1"
                      value={sizeStr}
                      disabled={isBusy}
                      onChange={(e) => setSizeStr(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: "var(--r)",
                        border: "1px solid var(--line)",
                        background: "var(--bg-soft)",
                        fontSize: 16,
                        fontFamily: "var(--f-tech)",
                        fontWeight: 700,
                        color: "var(--ink)",
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                      aria-label="Number of shares"
                    />
                    {econ.size < minSize && rawSize > 0 && (
                      <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--no)" }}>
                        Minimum {minSize} shares required
                      </p>
                    )}
                  </div>

                  {/* Full order summary */}
                  <div
                    style={{
                      background: "var(--bg-soft)",
                      borderRadius: "var(--r)",
                      border: "1px solid var(--line)",
                      padding: "12px 14px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                    }}
                  >
                    {[
                      ["Price", `${fmtCents(econ.limitPrice)} (FOK)`],
                      ["Cost", `${econ.displayCost} USDC.e`],
                      ["Max payout (if correct)", `$${econ.payout.toFixed(2)} USDC.e`],
                      ["USDC.e available", fmtRawUsdc(usdcApproval.balance)],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        style={{ display: "flex", justifyContent: "space-between", gap: 8 }}
                      >
                        <span style={{ fontSize: 12, color: "var(--muted)", flexShrink: 0 }}>
                          {label}
                        </span>
                        <span
                          style={{
                            fontSize: 12,
                            fontFamily: "var(--f-tech)",
                            fontWeight: 700,
                            color:
                              label === "USDC.e available" && insufficientBalance
                                ? "var(--no)"
                                : "var(--ink)",
                            textAlign: "right",
                          }}
                        >
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Insufficient balance warning */}
                  {insufficientBalance && (
                    <p
                      style={{
                        margin: 0,
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

                  {/* Authorize PM creds step (first-time per session) */}
                  {!creds && bet.status === "idle" && (
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
                        One-time wallet signature required to enable your trading account. Free and
                        deterministic. No funds are moved.
                      </p>
                      {credsError && (
                        <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--no)" }}>
                          {credsError}
                        </p>
                      )}
                      <button
                        type="button"
                        className="btn btn-primary btn-block"
                        onClick={handleDeriveCreds}
                        disabled={credsPending}
                        style={{ opacity: credsPending ? 0.65 : 1, width: "100%" }}
                      >
                        {credsPending ? "Signing..." : "Enable trading"}
                      </button>
                    </div>
                  )}

                  {/* USDC.e approval */}
                  {creds && usdcApproval.needsApproval && !insufficientBalance && !isBusy && (
                    <div>
                      {usdcApproval.error && (
                        <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--no)" }}>
                          {usdcApproval.error}
                        </p>
                      )}
                      <button
                        type="button"
                        className="btn btn-primary btn-block"
                        onClick={handleApprove}
                        disabled={usdcApproval.approving}
                        style={{ width: "100%", opacity: usdcApproval.approving ? 0.65 : 1 }}
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
                        {bet.status === "signing" && "Waiting for wallet signature on Polygon..."}
                        {bet.status === "submitting" && "Submitting order..."}
                        {bet.status === "polling" && "Waiting for fill confirmation..."}
                      </span>
                    </div>
                  )}

                  {/* Bet button */}
                  {creds && !isBusy && (
                    <button
                      type="button"
                      className="btn btn-primary btn-block"
                      onClick={handleBet}
                      disabled={!canBet}
                      style={{
                        width: "100%",
                        fontSize: 15,
                        padding: "13px 0",
                        opacity: canBet ? 1 : 0.5,
                        background: side === "yes" ? "var(--yes)" : "var(--no)",
                        border: "none",
                      }}
                    >
                      Bet now · {side.toUpperCase()} {fmtCents(econ.limitPrice)} · {econ.size}{" "}
                      shares
                    </button>
                  )}

                  {/* USDC.e funding note */}
                  <p
                    style={{
                      margin: 0,
                      fontSize: 11,
                      color: "var(--muted-2)",
                      lineHeight: 1.5,
                      textAlign: "center",
                    }}
                  >
                    Bets require USDC.e (bridged) in your Polygon wallet. Native USDC will not work.{" "}
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
                </>
              ) : (
                /* View-only panel */
                <div
                  style={{
                    background: "var(--bg-soft)",
                    border: "1px solid var(--line)",
                    borderRadius: "var(--r)",
                    padding: "18px 20px",
                    textAlign: "center",
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: 14,
                      color: "var(--muted)",
                      lineHeight: 1.6,
                    }}
                  >
                    Betting opens soon. Markets are live and view-only while we finish wiring real
                    settlement.
                  </p>
                </div>
              )}
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
