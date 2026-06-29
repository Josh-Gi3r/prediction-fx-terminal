"use client";

import { useEffect, useRef, useState } from "react";
import type { Address } from "viem";
import { useAccount, useBalance, useSendTransaction, useSignTypedData } from "wagmi";
import { logAction } from "../account/activityLog";
import type { FxConfig } from "../fx-provider/core/types";
import { CHAIN } from "../wagmi/config";
import { executeCow } from "./executors/cow";
import { executeKyber } from "./executors/kyber";
import { executeLifi } from "./executors/lifi";
import { executeFxProvider } from "./executors/fx-provider";
import type { NormalizedQuote } from "./source";

// ─── Status machine ───────────────────────────────────────────────────────────
//
// idle → signing? → signing_permit? → approving? → submitting → confirming
//                                                                  ├─ success      (outcome verified)
//                                                                  ├─ unconfirmed  (timeout, honest copy)
//                                                                  └─ error        (revert / failed)
//
// "success" is only reached after on-chain or API verification of the OUTCOME.
// "unconfirmed" means "submitted but we couldn't verify settlement within 90s".
// NEVER auto-retry from confirming — late FX provider settlement = double-execution.

export type SwapStatus =
  | "idle"
  | "signing"
  | "signing_permit"
  | "approving"
  | "submitting"
  | "confirming"
  | "success"
  | "unconfirmed"
  | "error";

/** When status === "success", settled amount and symbol for honest copy. */
export interface SettledReceipt {
  /** Human-readable amount received (output token). */
  amount: string;
  /** Output token symbol. */
  symbol: string;
}

/** Details of the pending approval shown to the user while status === "approving". */
export interface ApprovalDetail {
  /** ERC-20 token address being approved. */
  token: Address;
  /** Spender receiving the allowance (router or relayer). */
  spender: Address;
  /** Exact raw allowance amount (bigint serialised as string for safe JSON). */
  amountRaw: string;
  /** Chain ID the approval is being sent on. */
  chainId: number;
}

// ─── Pure approval-amount helpers (exported for unit testing) ─────────────────

/**
 * Exact approval amount for Kyber path.
 * No fee-on-transfer tokens in this desk; no buffer needed.
 */
export { kyberApprovalAmount } from "./executors/approve";

/**
 * Exact approval amount for CoW path.
 * CoW requires sellAmount + feeAmount to be approved to the RELAYER.
 */
export { cowApprovalAmount } from "./executors/approve";

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSwap() {
  const { address } = useAccount();
  // Native ETH balance — aggregator routes need gas the user must hold.
  const { data: nativeBal } = useBalance({ address });
  const { signTypedDataAsync } = useSignTypedData();
  const { sendTransactionAsync } = useSendTransaction();

  const [status, setStatus] = useState<SwapStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [tradeId, setTradeId] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<SettledReceipt | null>(null);
  const [approval, setApproval] = useState<ApprovalDetail | null>(null);
  // True when /api/order-status returned 401 — used for copy fallback in UI.
  const [orderStatusFailed401, setOrderStatusFailed401] = useState(false);

  // Cleanup handle — abort polling on unmount or reset.
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // ── helpers ──

  function abortPrior() {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    return abortRef.current.signal;
  }

  function finish(
    outcome: "success" | "unconfirmed" | "error",
    opts?: { err?: string; receipt?: SettledReceipt },
  ) {
    setApproval(null);
    setStatus(outcome);
    if (opts?.err) setError(opts.err);
    if (opts?.receipt) setReceipt(opts.receipt);
    // Record the swap in the local activity log (public metadata only) so it
    // surfaces on /account → Activity.
    if (outcome === "success" && opts?.receipt && address) {
      logAction(address, {
        type: "swap",
        amount: opts.receipt.amount,
        token: opts.receipt.symbol,
        chainId: CHAIN.id,
        txHash: tradeId ?? undefined,
      });
    }
  }

  // ── Main execute ──

  async function execute(quote: NormalizedQuote, config?: FxConfig) {
    // Pre-flight: kyber/lifi need ETH in the wallet for approve + swap gas.
    // FX provider needs none (executor submits and pays); CoW needs an allowance tx
    // only if none exists, but its approve also needs ETH.
    if (quote.source !== "fx-provider" && (nativeBal?.value ?? 0n) === 0n) {
      setStatus("error");
      setError(
        "This venue needs ETH in your wallet for gas. You have none. Swap via the FX provider instead (no ETH needed) or add ETH first.",
      );
      return;
    }
    setError(null);
    setTradeId(null);
    setReceipt(null);
    setApproval(null);
    setOrderStatusFailed401(false);
    const signal = abortPrior();

    try {
      // ── LiFi ──────────────────────────────────────────────────────────────
      if (quote.source === "lifi") {
        if (!address) throw new Error("connect a wallet");

        await executeLifi(quote, address, signal, sendTransactionAsync, {
          onApprovalNeeded: (detail) => {
            setApproval(detail);
            setStatus("approving");
          },
          onApprovalDone: () => setApproval(null),
          onSubmitting: () => setStatus("submitting"),
          onConfirming: (hash) => {
            setTradeId(hash);
            setStatus("confirming");
          },
          onSuccess: (r) => finish("success", { receipt: r }),
          onError: (e) => finish("error", { err: e }),
          onUnconfirmed: () => finish("unconfirmed"),
        });
        return;
      }

      // ── Kyber ─────────────────────────────────────────────────────────────
      if (quote.source === "kyber") {
        if (!address) throw new Error("connect a wallet");

        await executeKyber(quote, address, signal, sendTransactionAsync, {
          onApprovalNeeded: (detail) => {
            setApproval(detail);
            setStatus("approving");
          },
          onApprovalDone: () => setApproval(null),
          onSubmitting: () => setStatus("submitting"),
          onConfirming: (hash) => {
            setTradeId(hash);
            setStatus("confirming");
          },
          onSuccess: (r) => finish("success", { receipt: r }),
          onError: (e) => finish("error", { err: e }),
          onUnconfirmed: () => finish("unconfirmed"),
        });
        return;
      }

      // ── CoW ───────────────────────────────────────────────────────────────
      if (quote.source === "cow") {
        if (!address) throw new Error("connect a wallet");

        await executeCow(
          quote,
          address,
          signal,
          signTypedDataAsync as (params: unknown) => Promise<`0x${string}`>,
          {
            onApprovalNeeded: (detail) => {
              setApproval(detail);
              setStatus("approving");
            },
            onApprovalDone: () => setApproval(null),
            onSigning: () => setStatus("signing"),
            onSubmitting: () => setStatus("submitting"),
            onConfirming: (uid) => {
              setTradeId(uid);
              setStatus("confirming");
            },
            onSuccess: (r) => finish("success", { receipt: r }),
            onError: (e) => finish("error", { err: e }),
            onUnconfirmed: () => finish("unconfirmed"),
          },
        );
        return;
      }

      // ── FX Provider ─────────────────────────────────────────────────────────
      if (!config) throw new Error("missing FX provider config");
      if (quote.expiresAt && quote.expiresAt < Math.floor(Date.now() / 1000)) {
        throw new Error("Quote expired — adjust the amount to re-quote.");
      }
      if (!address) throw new Error("connect a wallet");

      await executeFxProvider(
        quote,
        config,
        address,
        signal,
        signTypedDataAsync as (params: unknown) => Promise<`0x${string}`>,
        {
          onSigning: () => setStatus("signing"),
          onSigningPermit: () => setStatus("signing_permit"),
          onSubmitting: () => setStatus("submitting"),
          onConfirming: (id) => {
            setTradeId(id);
            setStatus("confirming");
          },
          onSuccess: (r) => finish("success", { receipt: r }),
          onError: (e) => finish("error", { err: e }),
          onUnconfirmed: () => finish("unconfirmed"),
          on401: () => setOrderStatusFailed401(true),
        },
      );
    } catch (e) {
      if (signal.aborted) return;
      const msg =
        (e as { shortMessage?: string })?.shortMessage ?? (e as Error)?.message ?? "swap failed";
      setError(msg);
      setApproval(null);
      setStatus("error");
    }
  }

  function reset() {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus("idle");
    setError(null);
    setTradeId(null);
    setReceipt(null);
    setApproval(null);
    setOrderStatusFailed401(false);
  }

  return { execute, status, error, tradeId, receipt, reset, orderStatusFailed401, approval };
}
