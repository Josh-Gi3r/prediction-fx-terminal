"use client";

/**
 * FundWalletModal — cross-chain bridge from Ethereum stables → Polygon USDC.e.
 *
 * Flow:
 *   1. User picks source token (USDC or USDT from their Ethereum wallet).
 *   2. User enters amount; modal fetches a live bridge quote from /api/bridge-quote.
 *   3. "Include POL for fees" toggle is ON by default — when on, a note explains
 *      that the user needs a small POL balance separately (LiFi's fromAmountForGas
 *      does not work for this corridor — see lib/bridge/quote.ts for details).
 *   4. Execute:
 *        a. ensureAllowance(fromToken on Ethereum, approvalAddress, amount)
 *        b. sendTransaction(transactionRequest) — Ethereum only, chainId=1
 *        c. Poll Polygon USDC.e balanceOf every 15s until balance increases by at
 *           least toAmountMin or 10 min. A balance increase of less than toAmountMin
 *           is treated as an unrelated transfer and ignored.
 *   5. On success: show confirmation with Polygonscan link.
 *      On timeout: honest "still in transit" message with etherscan tx link.
 *
 * Notes on Privy embedded wallets:
 *   - useSendTransaction from wagmi works through the Privy connector.
 *   - No chain-switch needed: the bridge tx runs on Ethereum (chainId=1).
 *   - The Polygon balance poll uses a public viem client — no wallet interaction.
 */

import { ETH_USDC, ETH_USDT, POLYGON_USDCE } from "@/lib/bridge/quote";
import type { BridgeQuoteResponse } from "@/lib/bridge/types";
import { ensureAllowance } from "@/lib/desks/executors/approve";
import { useTokens, useWalletBalances } from "@/lib/desks/hooks";
import { wagmiConfig } from "@/lib/wagmi/config";
import { waitForTransactionReceipt } from "@wagmi/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { http, createPublicClient, erc20Abi, formatUnits, parseUnits } from "viem";
import { useAccount, useSendTransaction } from "wagmi";
import { mainnet, polygon } from "wagmi/chains";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Destination poll: every 15s, up to 10 minutes. */
const POLL_INTERVAL_MS = 15_000;
const POLL_MAX_MS = 10 * 60 * 1_000;

const ETH_USDC_LOWER = ETH_USDC.toLowerCase();
const ETH_USDT_LOWER = ETH_USDT.toLowerCase();

const POLYGON_RPC =
  typeof process !== "undefined"
    ? (process.env.NEXT_PUBLIC_POLYGON_RPC ?? "https://polygon-bor-rpc.publicnode.com")
    : "https://polygon-bor-rpc.publicnode.com";

function polygonPublicClient() {
  return createPublicClient({ chain: polygon, transport: http(POLYGON_RPC) });
}

// ─── Source token config ──────────────────────────────────────────────────────

interface SourceToken {
  address: string;
  symbol: string;
  decimals: number;
}

const SOURCE_TOKENS: SourceToken[] = [
  { address: ETH_USDC, symbol: "USDC", decimals: 6 },
  { address: ETH_USDT, symbol: "USDT", decimals: 6 },
];

// ─── Status machine ───────────────────────────────────────────────────────────

type BridgeStatus =
  | "idle"
  | "quoting"
  | "approving"
  | "submitting"
  | "bridging"
  | "success"
  | "transit" // timed out but tx confirmed — bridge is slow
  | "error";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtUsdc(raw: bigint | null): string {
  if (raw === null) return "...";
  return `$${(Number(raw) / 1e6).toFixed(2)}`;
}

function fmtSeconds(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  return `~${m} min`;
}

/**
 * Convert a human-readable amount string to the raw integer string using exact
 * bigint arithmetic (viem parseUnits) rather than floating-point multiplication.
 * Avoids precision drift for amounts like "1.000001" at 6 decimals (P2-3 fix).
 */
function toRawAmount(humanStr: string, decimals: number): string {
  try {
    return parseUnits(humanStr as `${number}`, decimals).toString();
  } catch {
    // parseUnits throws on non-numeric / empty input
    return "0";
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface FundWalletModalProps {
  open: boolean;
  onClose: () => void;
  /** Pre-fill amount (e.g. from bet cost). */
  suggestedAmount?: number;
  /** Available balances: symbol -> raw amount string (from useWalletBalances). */
  balances?: Record<string, string>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FundWalletModal({
  open,
  onClose,
  suggestedAmount,
  balances = {},
}: FundWalletModalProps) {
  const { address } = useAccount();
  const { sendTransactionAsync } = useSendTransaction();

  // Self-contained balances: read the wallet directly when the parent passes none.
  const { data: tokenList } = useTokens();
  const { balances: ownBalances } = useWalletBalances(address, tokenList ?? []);

  const [selectedToken, setSelectedToken] = useState<SourceToken>(SOURCE_TOKENS[0]!);
  const [amountStr, setAmountStr] = useState(suggestedAmount ? String(suggestedAmount) : "");
  const [gasOnDest, setGasOnDest] = useState(true);

  const [quote, setQuote] = useState<BridgeQuoteResponse | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [status, setStatus] = useState<BridgeStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [ethTxHash, setEthTxHash] = useState<string | null>(null);
  const [destinationBalanceBefore, setDestinationBalanceBefore] = useState<bigint | null>(null);

  const quoteAbort = useRef<AbortController | null>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  // Reset when opened — also cancel any in-flight quote request and running poll
  // so that a close-then-reopen doesn't flash stale success state (P1-C fix).
  useEffect(() => {
    if (open) {
      // Cancel previous in-flight operations before resetting state.
      quoteAbort.current?.abort();
      if (pollTimer.current) {
        clearTimeout(pollTimer.current);
        pollTimer.current = null;
      }
      setAmountStr(suggestedAmount ? String(suggestedAmount) : "");
      setQuote(null);
      setQuoteError(null);
      setStatus("idle");
      setError(null);
      setEthTxHash(null);
      setDestinationBalanceBefore(null);
    }
  }, [open, suggestedAmount]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      quoteAbort.current?.abort();
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, []);

  // ── Balance helpers ──
  const rawBalance = (token: SourceToken): bigint => {
    const b = balances[token.symbol] ?? ownBalances[token.symbol];
    return b ? BigInt(b) : 0n;
  };

  const maxHuman = (token: SourceToken): number => {
    const raw = rawBalance(token);
    return Number(raw) / 10 ** token.decimals;
  };

  // ── Fetch quote ──
  const fetchQuote = useCallback(async () => {
    if (!address || !amountStr || Number(amountStr) <= 0) {
      setQuote(null);
      setQuoteError(null);
      return;
    }
    quoteAbort.current?.abort();
    quoteAbort.current = new AbortController();

    setStatus("quoting");
    setQuoteError(null);

    try {
      const fromAmountRaw = toRawAmount(amountStr, selectedToken.decimals);
      if (fromAmountRaw === "0") {
        setStatus("idle");
        return;
      }

      const res = await fetch("/api/bridge-quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fromToken: selectedToken.address,
          fromAmountRaw,
          owner: address,
          gasOnDestination: gasOnDest,
        }),
        signal: quoteAbort.current.signal,
      });

      if (!mountedRef.current) return;

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        setQuoteError(err.error ?? "Bridge quote failed");
        setStatus("idle");
        setQuote(null);
        return;
      }

      const data = (await res.json()) as BridgeQuoteResponse;
      if (!mountedRef.current) return;
      setQuote(data);
      setStatus("idle");
    } catch (e) {
      if (!mountedRef.current) return;
      if ((e as Error).name === "AbortError") return;
      setQuoteError((e as Error).message ?? "Quote failed");
      setStatus("idle");
    }
  }, [address, amountStr, selectedToken, gasOnDest]);

  // Re-quote on relevant changes, debounced
  useEffect(() => {
    const id = setTimeout(fetchQuote, 600);
    return () => clearTimeout(id);
  }, [fetchQuote]);

  // ── Poll destination balance ──
  //
  // P1-C fix: require balance increase >= toAmountMin to avoid false success on
  // unrelated incoming transfers or dust. toAmountMin is passed in as a snapshot
  // captured at bridge-submit time so the closure doesn't go stale if quote changes.
  const pollDestination = useCallback(
    async (owner: `0x${string}`, balBefore: bigint, startMs: number, toAmountMin: bigint) => {
      if (!mountedRef.current) return;

      const elapsed = Date.now() - startMs;
      if (elapsed >= POLL_MAX_MS) {
        setStatus("transit");
        return;
      }

      try {
        const client = polygonPublicClient();
        const balNow = (await client.readContract({
          address: POLYGON_USDCE as `0x${string}`,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [owner],
        })) as bigint;

        if (!mountedRef.current) return;

        // Only declare success when the balance increase is at least toAmountMin.
        // A smaller increase (< toAmountMin) means an unrelated transfer arrived —
        // keep polling.
        if (balNow - balBefore >= toAmountMin) {
          setStatus("success");
          return;
        }
      } catch {
        // ignore transient RPC errors, keep polling
      }

      pollTimer.current = setTimeout(() => {
        pollDestination(owner, balBefore, startMs, toAmountMin);
      }, POLL_INTERVAL_MS);
    },
    [],
  );

  // ── Execute bridge ──
  const handleBridge = useCallback(async () => {
    if (!quote || !address) return;

    setError(null);
    setStatus("idle");

    // Snapshot the current Polygon USDC.e balance before bridging.
    let balBefore = 0n;
    try {
      const client = polygonPublicClient();
      balBefore = (await client.readContract({
        address: POLYGON_USDCE as `0x${string}`,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address as `0x${string}`],
      })) as bigint;
    } catch {
      // proceed anyway; poll will just wait for the full toAmountMin delta
    }
    setDestinationBalanceBefore(balBefore);

    // Snapshot toAmountMin as bigint at submit time to guard the poll closure.
    const toAmountMin = BigInt(quote.toAmountMin);

    try {
      // Step 1: Approve the LiFi spender on Ethereum for the source token.
      const fromAmountRaw = toRawAmount(amountStr, selectedToken.decimals);
      setStatus("approving");

      await ensureAllowance(
        selectedToken.address as `0x${string}`,
        quote.approvalAddress as `0x${string}`,
        BigInt(fromAmountRaw),
        address as `0x${string}`,
        {
          onApprovalNeeded: () => {}, // status already "approving"
          onApprovalDone: () => {},
        },
      );

      if (!mountedRef.current) return;

      // Step 2: Submit the bridge transaction on Ethereum.
      setStatus("submitting");
      const tx = quote.transactionRequest;

      const hash = await sendTransactionAsync({
        to: tx.to as `0x${string}`,
        data: tx.data as `0x${string}`,
        value: tx.value && tx.value !== "0x0" ? BigInt(tx.value) : undefined,
        chainId: mainnet.id,
      });

      if (!mountedRef.current) return;
      setEthTxHash(hash);
      setStatus("bridging");

      // Step 3: Wait for the Ethereum receipt.
      const receipt = await Promise.race([
        waitForTransactionReceipt(wagmiConfig, { hash }),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 60_000)),
      ]);

      if (!mountedRef.current) return;

      if (receipt.status === "reverted") {
        setStatus("error");
        setError("Bridge transaction reverted on Ethereum.");
        return;
      }

      // Step 4: Poll Polygon until USDC.e lands (at least toAmountMin received).
      pollDestination(address as `0x${string}`, balBefore, Date.now(), toAmountMin);
    } catch (e) {
      if (!mountedRef.current) return;
      const msg = (e as Error).message ?? "Bridge failed";
      if (msg.toLowerCase().includes("user rejected") || msg.toLowerCase().includes("denied")) {
        setStatus("idle");
        setError("Transaction cancelled.");
      } else {
        setStatus("error");
        setError(msg);
      }
    }
  }, [quote, address, amountStr, selectedToken, sendTransactionAsync, pollDestination]);

  if (!open) return null;

  const toAmountHuman = quote ? (Number(quote.toAmountMin) / 1e6).toFixed(2) : null;
  const isExecuting = status === "approving" || status === "submitting" || status === "bridging";
  const isDone = status === "success" || status === "transit";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 300,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.55)",
        padding: "16px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isExecuting) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && !isExecuting) onClose();
      }}
    >
      {/* biome-ignore lint/a11y/useSemanticElements: modal shell */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Fund Polygon wallet"
        style={{
          background: "var(--bg)",
          borderRadius: "var(--r-xl)",
          boxShadow: "var(--sh-3)",
          width: "100%",
          maxWidth: 480,
          padding: "28px 24px 32px",
          display: "flex",
          flexDirection: "column",
          gap: 20,
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div
              style={{
                fontFamily: "var(--f-tech)",
                fontSize: 10,
                letterSpacing: ".12em",
                textTransform: "uppercase",
                color: "var(--muted-2)",
                marginBottom: 3,
              }}
            >
              Bridge · Ethereum to Polygon
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "var(--ink)" }}>
              Fund Polygon wallet
            </div>
          </div>
          {!isExecuting && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--muted)",
                fontSize: 22,
                lineHeight: 1,
                padding: 4,
              }}
            >
              x
            </button>
          )}
        </div>

        {/* Success state */}
        {status === "success" && (
          <div
            style={{
              background: "var(--yes-soft)",
              border: "1px solid var(--yes)",
              borderRadius: "var(--r)",
              padding: "18px 20px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 20, marginBottom: 6 }}>USDC.e arrived on Polygon</div>
            <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>
              Your wallet is funded. You can now approve USDC.e and place a bet.
            </p>
            {ethTxHash && (
              <div
                style={{
                  marginTop: 10,
                  fontSize: 11,
                  fontFamily: "var(--f-tech)",
                  color: "var(--muted-2)",
                }}
              >
                <a
                  href={`https://etherscan.io/tx/${ethTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "var(--brand)" }}
                >
                  View Ethereum tx
                </a>
              </div>
            )}
            <button
              type="button"
              className="btn btn-primary"
              style={{ marginTop: 16, width: "100%" }}
              onClick={onClose}
            >
              Done
            </button>
          </div>
        )}

        {/* Transit state (timeout but tx confirmed) */}
        {status === "transit" && (
          <div
            style={{
              background: "var(--bg-soft)",
              border: "1px solid var(--brand)",
              borderRadius: "var(--r)",
              padding: "18px 20px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--brand)", marginBottom: 6 }}>
              Still in transit
            </div>
            <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>
              Bridges can take up to 30 min. Your funds are safe — the Ethereum transaction
              confirmed. Check your Polygon wallet in a few minutes.
            </p>
            {ethTxHash && (
              <div
                style={{
                  marginTop: 10,
                  fontSize: 11,
                  fontFamily: "var(--f-tech)",
                  color: "var(--muted-2)",
                }}
              >
                Ethereum tx:{" "}
                <a
                  href={`https://etherscan.io/tx/${ethTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "var(--brand)" }}
                >
                  {ethTxHash.slice(0, 10)}...{ethTxHash.slice(-6)}
                </a>
              </div>
            )}
            <button
              type="button"
              className="btn"
              style={{ marginTop: 16, width: "100%", borderColor: "var(--line)" }}
              onClick={onClose}
            >
              Close
            </button>
          </div>
        )}

        {/* Main form — hidden once done */}
        {!isDone && (
          <>
            {/* Source token selector */}
            <div>
              <div
                style={{
                  fontFamily: "var(--f-tech)",
                  fontSize: 10,
                  color: "var(--muted-2)",
                  letterSpacing: ".1em",
                  textTransform: "uppercase",
                  marginBottom: 8,
                }}
              >
                From (Ethereum)
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {SOURCE_TOKENS.map((tok) => {
                  const bal = rawBalance(tok);
                  const humanBal = (Number(bal) / 10 ** tok.decimals).toFixed(2);
                  const isSelected = selectedToken.address === tok.address;
                  return (
                    <button
                      key={tok.address}
                      type="button"
                      disabled={isExecuting}
                      onClick={() => {
                        setSelectedToken(tok);
                        setQuote(null);
                      }}
                      style={{
                        flex: 1,
                        padding: "10px 12px",
                        borderRadius: "var(--r)",
                        border: `1.5px solid ${isSelected ? "var(--brand)" : "var(--line)"}`,
                        background: isSelected ? "var(--brand-soft, var(--bg-soft))" : "var(--bg)",
                        cursor: isExecuting ? "not-allowed" : "pointer",
                        textAlign: "left",
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)" }}>
                        {tok.symbol}
                      </div>
                      <div
                        style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--f-tech)" }}
                      >
                        {humanBal} available
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Amount input */}
            <div>
              <div
                style={{
                  fontFamily: "var(--f-tech)",
                  fontSize: 10,
                  color: "var(--muted-2)",
                  letterSpacing: ".1em",
                  textTransform: "uppercase",
                  marginBottom: 6,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span>Amount</span>
                <button
                  type="button"
                  disabled={isExecuting}
                  onClick={() => {
                    const raw = rawBalance(selectedToken);
                    if (raw > 0n) {
                      // Use exact bigint → decimal conversion to avoid float drift (P2-3).
                      const exact = formatUnits(raw, selectedToken.decimals).replace(/\.?0+$/, "");
                      setAmountStr(exact || "0");
                    }
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--brand)",
                    fontSize: 10,
                    fontFamily: "var(--f-tech)",
                    letterSpacing: ".1em",
                    textTransform: "uppercase",
                    padding: 0,
                  }}
                >
                  Max
                </button>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  border: "1px solid var(--line)",
                  borderRadius: "var(--r)",
                  background: "var(--bg-soft)",
                  padding: "0 12px",
                }}
              >
                <span style={{ color: "var(--muted)", fontSize: 16, marginRight: 4 }}>$</span>
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={amountStr}
                  disabled={isExecuting}
                  onChange={(e) => {
                    setAmountStr(e.target.value);
                    setQuote(null);
                  }}
                  placeholder="0.00"
                  style={{
                    flex: 1,
                    background: "none",
                    border: "none",
                    outline: "none",
                    fontSize: 20,
                    fontFamily: "var(--f-tech)",
                    fontWeight: 700,
                    color: "var(--ink)",
                    padding: "12px 0",
                  }}
                  aria-label={`Amount in ${selectedToken.symbol}`}
                />
                <span
                  style={{
                    fontSize: 13,
                    fontFamily: "var(--f-tech)",
                    color: "var(--muted-2)",
                    marginLeft: 6,
                  }}
                >
                  {selectedToken.symbol}
                </span>
              </div>
            </div>

            {/* Gas on destination toggle */}
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                cursor: isExecuting ? "not-allowed" : "pointer",
                background: "var(--bg-soft)",
                borderRadius: "var(--r)",
                border: "1px solid var(--line)",
                padding: "10px 14px",
              }}
            >
              <input
                type="checkbox"
                checked={gasOnDest}
                disabled={isExecuting}
                onChange={(e) => setGasOnDest(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: "var(--brand)", flexShrink: 0 }}
              />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
                  Include POL for fees
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2, lineHeight: 1.4 }}>
                  {gasOnDest
                    ? "You'll need ~0.1 POL on Polygon to approve USDC.e. Get it from gas.zip or Polygon faucet."
                    : "You'll need POL separately before you can approve USDC.e on Polygon."}
                </div>
              </div>
            </label>

            {/* Quote display */}
            {status === "quoting" && (
              <div
                style={{
                  background: "var(--bg-soft)",
                  borderRadius: "var(--r)",
                  border: "1px solid var(--line)",
                  padding: "12px 14px",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "var(--brand)",
                    animation: "pulse 1.2s infinite",
                    display: "inline-block",
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: 12, color: "var(--muted)" }}>Getting bridge quote...</span>
              </div>
            )}

            {quoteError && status !== "quoting" && (
              <div
                style={{
                  background: "var(--no-soft)",
                  border: "1px solid var(--no)",
                  borderRadius: "var(--r)",
                  padding: "10px 14px",
                  fontSize: 12,
                  color: "var(--no)",
                }}
              >
                {quoteError}
              </div>
            )}

            {quote && status !== "quoting" && !isExecuting && (
              <div
                style={{
                  background: "var(--bg-soft)",
                  borderRadius: "var(--r)",
                  border: "1px solid var(--line)",
                  padding: "12px 14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                {[
                  ["You receive (min)", `≥ ${toAmountHuman} USDC.e on Polygon`],
                  ["Arrives in", fmtSeconds(quote.executionSeconds)],
                  ["Ethereum gas", quote.gasUsd > 0 ? `~$${quote.gasUsd.toFixed(2)}` : "< $0.01"],
                  ["Bridge", quote.tool],
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
                {quote.gasDropNote && (
                  <div
                    style={{
                      marginTop: 4,
                      padding: "8px 10px",
                      background: "var(--bg-tint, var(--bg))",
                      borderRadius: "var(--r-sm, 4px)",
                      fontSize: 11,
                      color: "var(--muted)",
                      lineHeight: 1.5,
                      borderLeft: "3px solid var(--brand)",
                    }}
                  >
                    {quote.gasDropNote}
                  </div>
                )}
              </div>
            )}

            {/* In-flight status */}
            {isExecuting && (
              <div
                style={{
                  background: "var(--bg-soft)",
                  borderRadius: "var(--r)",
                  border: "1px solid var(--line)",
                  padding: "14px 16px",
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
                <div>
                  <div style={{ fontSize: 13, color: "var(--ink)", fontWeight: 600 }}>
                    {status === "approving" && "Approving token..."}
                    {status === "submitting" && "Submitting bridge transaction..."}
                    {status === "bridging" &&
                      `Bridging — waiting for Polygon (${fmtSeconds(quote?.executionSeconds ?? 1200)})`}
                  </div>
                  {status === "bridging" && (
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>
                      Bridging takes time. You can close this and check back.
                    </div>
                  )}
                  {status === "bridging" && ethTxHash && (
                    <div
                      style={{
                        fontSize: 11,
                        fontFamily: "var(--f-tech)",
                        color: "var(--muted-2)",
                        marginTop: 4,
                      }}
                    >
                      <a
                        href={`https://etherscan.io/tx/${ethTxHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "var(--brand)" }}
                      >
                        View tx on Etherscan
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Error */}
            {status === "error" && error && (
              <div
                style={{
                  background: "var(--no-soft)",
                  border: "1px solid var(--no)",
                  borderRadius: "var(--r)",
                  padding: "12px 14px",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--no)", marginBottom: 4 }}>
                  Bridge failed
                </div>
                <p
                  style={{
                    margin: "0 0 10px",
                    fontSize: 12,
                    color: "var(--muted)",
                    lineHeight: 1.5,
                  }}
                >
                  {error}
                </p>
                <button
                  type="button"
                  className="btn"
                  style={{ borderColor: "var(--line)" }}
                  onClick={() => {
                    setStatus("idle");
                    setError(null);
                  }}
                >
                  Try again
                </button>
              </div>
            )}

            {/* Bridge button */}
            {!isExecuting && status !== "error" && (
              <button
                type="button"
                className="btn btn-primary btn-block"
                onClick={handleBridge}
                disabled={
                  !quote || !address || !amountStr || Number(amountStr) <= 0 || status === "quoting"
                }
                style={{
                  width: "100%",
                  fontSize: 15,
                  padding: "13px 0",
                  opacity:
                    !quote ||
                    !address ||
                    !amountStr ||
                    Number(amountStr) <= 0 ||
                    status === "quoting"
                      ? 0.5
                      : 1,
                }}
              >
                {quote
                  ? `Bridge ${amountStr} ${selectedToken.symbol} to Polygon`
                  : status === "quoting"
                    ? "Getting quote..."
                    : "Enter an amount to continue"}
              </button>
            )}

            {/* Destination note */}
            <p
              style={{
                margin: 0,
                fontSize: 11,
                color: "var(--muted-2)",
                lineHeight: 1.5,
                textAlign: "center",
              }}
            >
              Funds arrive as USDC.e on Polygon. Bridge transactions are irreversible. FX Terminal is
              never in the custody path.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
