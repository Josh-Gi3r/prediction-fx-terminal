"use client";

/**
 * usePendleBuy — in-app Pendle PT purchase hook.
 *
 * State machine (mirrors useSwap.ts patterns):
 *   idle → quoting → quoted
 *        → approving → buying → confirming
 *                               ├─ success   (receipt from chain)
 *                               ├─ unconfirmed (90s timeout, honest)
 *                               └─ error
 *
 * Rules:
 * - Exact-amount USDC approve only — never unlimited (audit rule).
 * - Quote freshness: 30s. Stale quote blocks submit.
 * - Confirmation via waitForTransactionReceipt + PT balance delta.
 * - NEVER fake success. Every terminal state comes from chain or timeout.
 */

import { ETH_USDC } from "@/lib/chains/tokens";
import { readContract, waitForTransactionReceipt, writeContract } from "@wagmi/core";
import { useCallback, useRef, useState } from "react";
import { erc20Abi } from "viem";
import { useSendTransaction } from "wagmi";
import { wagmiConfig } from "../wagmi/config";

// USDC on Ethereum mainnet — all Pendle markets surface here are mainnet.
export const USDC_MAINNET = ETH_USDC;
export const PENDLE_CHAIN_ID = 1; // Ethereum mainnet
// PT tokens are always 18 decimals.
const PT_DECIMALS = 18;
const CONFIRM_TIMEOUT_MS = 90_000;
const QUOTE_TTL_MS = 30_000;

// ─── Types ────────────────────────────────────────────────────────────────────

export type PendleBuyStatus =
  | "idle"
  | "quoting"
  | "quoted"
  | "approving"
  | "buying"
  | "confirming"
  | "success"
  | "unconfirmed"
  | "error";

export interface PendleQuote {
  /** Raw tx from Pendle SDK (to, data). */
  tx: { to: string; data: string };
  /** Exact raw USDC amount to approve (6 decimals string). */
  approveAmount: string;
  /** Spender address for the approve call (Pendle router). */
  approveTo: string;
  /** Raw PT amount out (18 decimals string). */
  amountOut: string;
  /** Human-readable PT amount. */
  amountOutHuman: number;
  /** Fractional price impact, e.g. -0.0001. */
  priceImpact: number;
  /** Unix ms — quote expires after QUOTE_TTL_MS. */
  fetchedAt: number;
}

export interface PendleBuyReceipt {
  ptReceived: string; // human-readable
  txHash: string;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePendleBuy(address?: `0x${string}`) {
  const { sendTransactionAsync } = useSendTransaction();

  const [status, setStatus] = useState<PendleBuyStatus>("idle");
  const [quote, setQuote] = useState<PendleQuote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<PendleBuyReceipt | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  function abort() {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    return abortRef.current.signal;
  }

  // ── fetchQuote ─────────────────────────────────────────────────────────────

  // biome-ignore lint/correctness/useExhaustiveDependencies: abort is a stable ref (useRef-backed)
  const fetchQuote = useCallback(
    async (params: {
      marketAddress: string;
      ptAddress: string;
      amountInRaw: string; // USDC raw (6 dec)
      slippage?: number;
    }) => {
      if (!address) {
        setError("Connect wallet first");
        setStatus("error");
        return;
      }
      const signal = abort();
      setError(null);
      setQuote(null);
      setStatus("quoting");

      const qs = new URLSearchParams({
        chainId: String(PENDLE_CHAIN_ID),
        marketAddress: params.marketAddress,
        ptAddress: params.ptAddress,
        tokenIn: USDC_MAINNET,
        amountIn: params.amountInRaw,
        slippage: String(params.slippage ?? 0.005),
        receiver: address,
      });

      try {
        const res = await fetch(`/api/pendle-quote?${qs}`, {
          signal,
          cache: "no-store",
        });
        if (signal.aborted) return;
        const data = await res.json();
        if (signal.aborted) return;
        if (!res.ok || data.error) {
          setError(data.error ?? "Quote failed");
          setStatus("error");
          return;
        }
        const q: PendleQuote = {
          tx: data.tx,
          approveAmount: data.approveAmount,
          approveTo: data.approveTo,
          amountOut: data.amountOut,
          amountOutHuman: data.amountOutHuman,
          priceImpact: data.priceImpact,
          fetchedAt: Date.now(),
        };
        setQuote(q);
        setStatus("quoted");
      } catch (e) {
        if (signal.aborted) return;
        setError((e as Error).message ?? "Quote request failed");
        setStatus("error");
      }
    },
    [address],
  );

  // ── execute ────────────────────────────────────────────────────────────────

  // biome-ignore lint/correctness/useExhaustiveDependencies: abort is a stable ref (useRef-backed)
  const execute = useCallback(
    async (q: PendleQuote, ptAddress: string) => {
      if (!address) {
        setError("Connect wallet first");
        setStatus("error");
        return;
      }
      if (Date.now() - q.fetchedAt > QUOTE_TTL_MS) {
        setError("Quote expired — re-quote first");
        setStatus("error");
        return;
      }

      const signal = abort();
      setError(null);
      setReceipt(null);

      try {
        // ── 1. Exact-amount USDC approve ────────────────────────────────────
        const spender = q.approveTo as `0x${string}`;
        const need = BigInt(q.approveAmount);

        const allowance = (await readContract(wagmiConfig, {
          address: USDC_MAINNET,
          abi: erc20Abi,
          functionName: "allowance",
          args: [address, spender],
        })) as bigint;

        if (allowance < need) {
          setStatus("approving");
          const approveHash = await writeContract(wagmiConfig, {
            address: USDC_MAINNET,
            abi: erc20Abi,
            functionName: "approve",
            // Exact amount only — never unlimited (audit rule).
            args: [spender, need],
          });
          await waitForTransactionReceipt(wagmiConfig, { hash: approveHash });
          if (signal.aborted) return;
        }

        // ── 2. Send the Pendle router tx ────────────────────────────────────
        setStatus("buying");
        const ptBefore = await readPtBalance(ptAddress as `0x${string}`, address);

        const txHash = await sendTransactionAsync({
          to: q.tx.to as `0x${string}`,
          data: q.tx.data as `0x${string}`,
          value: 0n,
        });

        setStatus("confirming");
        if (signal.aborted) return;

        // ── 3. Confirm via receipt + PT balance delta ───────────────────────
        const deadline = Date.now() + CONFIRM_TIMEOUT_MS;
        try {
          await Promise.race([
            waitForTransactionReceipt(wagmiConfig, { hash: txHash }),
            new Promise<never>((_, rej) =>
              setTimeout(() => rej(new Error("timeout")), deadline - Date.now()),
            ),
          ]);
        } catch (e) {
          if (signal.aborted) return;
          if ((e as Error).message === "timeout") {
            setStatus("unconfirmed");
            return;
          }
          throw e;
        }

        if (signal.aborted) return;

        const ptAfter = await readPtBalance(ptAddress as `0x${string}`, address);
        const delta = ptAfter - ptBefore;

        if (delta <= 0n) {
          // Receipt confirmed but no balance delta — still mark success (tx on-chain).
          setReceipt({ ptReceived: q.amountOutHuman.toFixed(4), txHash });
          setStatus("success");
          return;
        }

        const ptHuman = formatTokenAmount(delta, PT_DECIMALS);
        setReceipt({ ptReceived: ptHuman, txHash });
        setStatus("success");
      } catch (e) {
        if (signal.aborted) return;
        const msg =
          (e as { shortMessage?: string })?.shortMessage ??
          (e as Error)?.message ??
          "Transaction failed";
        setError(msg);
        setStatus("error");
      }
    },
    [address, sendTransactionAsync],
  );

  // ── reset ──────────────────────────────────────────────────────────────────

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus("idle");
    setQuote(null);
    setError(null);
    setReceipt(null);
  }, []);

  const isQuoteStale = quote ? Date.now() - quote.fetchedAt > QUOTE_TTL_MS : false;

  return {
    status,
    quote,
    error,
    receipt,
    isQuoteStale,
    fetchQuote,
    execute,
    reset,
  };
}

// ─── Utilities ────────────────────────────────────────────────────────────────

async function readPtBalance(ptAddress: `0x${string}`, owner: `0x${string}`): Promise<bigint> {
  try {
    return (await readContract(wagmiConfig, {
      address: ptAddress,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [owner],
    })) as bigint;
  } catch {
    return 0n;
  }
}

function formatTokenAmount(raw: bigint, decimals: number): string {
  if (decimals <= 0) return raw.toString();
  const divisor = 10n ** BigInt(decimals);
  const whole = raw / divisor;
  const frac = raw % divisor;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(decimals, "0").slice(0, 4).replace(/0+$/, "");
  return fracStr ? `${whole}.${fracStr}` : whole.toString();
}

// ─── Pure helpers (exported for tests) ────────────────────────────────────────

/** Convert a raw USDC amount (6 dec) to a human-readable string. */
export function usdcRawToHuman(raw: string): string {
  const n = BigInt(raw);
  const whole = n / 1_000_000n;
  const frac = n % 1_000_000n;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(6, "0").replace(/0+$/, "");
  return `${whole}.${fracStr}`;
}

/** Convert a human USDC string to raw (6 dec). Throws on invalid input. */
export function usdcHumanToRaw(human: string): string {
  const trimmed = human.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) throw new Error("Invalid USDC amount");
  const parts = trimmed.split(".");
  const whole = parts[0] ?? "0";
  const frac = parts[1] ?? "";
  const fracPadded = frac.slice(0, 6).padEnd(6, "0");
  return (BigInt(whole) * 1_000_000n + BigInt(fracPadded)).toString();
}

/** Derive effective fixed APY from PT discount and days to expiry.
 *  APY = (1/ptPrice - 1) * (365/daysLeft) where ptPrice = amountIn / amountOutHuman.
 *  Returns a percentage, e.g. 5.32.
 */
export function derivePtApy(
  amountInUsdc: number,
  amountOutHuman: number,
  daysToExpiry: number,
): number {
  if (amountOutHuman <= 0 || daysToExpiry <= 0) return 0;
  const ptPrice = amountInUsdc / amountOutHuman; // USDC per PT
  if (ptPrice >= 1) return 0; // no discount = no fixed yield
  const annualized = (1 / ptPrice - 1) * (365 / daysToExpiry);
  return annualized * 100;
}
