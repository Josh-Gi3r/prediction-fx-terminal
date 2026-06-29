"use client";

/**
 * useHlpDeposit — in-app Hyperliquid HLP deposit hook.
 *
 * State machine:
 *   idle → bridging  (USDC ERC20 transfer to HL bridge on Arbitrum)
 *        → crediting (polling HL account balance for USDC credit)
 *        → delegating (vaultTransfer signed + submitted to HL L1)
 *        → polling   (polling vault equity for user)
 *        → success
 *        → unconfirmed (timeout — "check your HL account")
 *        └─ error
 *
 * Mechanism verified from @nktkas/hyperliquid SDK + HL docs:
 *
 *   Step 1 — BRIDGE:
 *     ERC20 transfer: USDC (Arbitrum) → HL bridge at 0x2Df1c51E09aECF9cacB7bc98cB1742757f163dF7
 *     Minimum: 5 USDC.
 *     The bridge is a plain ERC20 transfer (no calldata), confirmed on-chain.
 *     Credit appears on the user's HL account within ~1 min.
 *     Account is created implicitly on first deposit.
 *
 *   Step 2 — DELEGATE TO HLP:
 *     SDK: ExchangeClient.vaultTransfer({ vaultAddress, isDeposit: true, usd: amount * 1e6 })
 *     The SDK takes { transport, wallet } where wallet is a viem JSON-RPC account
 *     (compatible with wagmi useWalletClient).
 *     vaultAddress = 0xdfc24b077bc1425ad1dea75bcb6f8158e10df303 (the HLP vault).
 *     usd = amount * 1e6 (HL uses 1e6 scaling for USD values).
 *
 * Browser wallet compatibility:
 *   The HL SDK's AbstractViemJsonRpcAccount interface requires:
 *     - signTypedData(params): confirmed available on viem WalletClient
 *     - getAddresses(): confirmed available
 *     - getChainId(): confirmed available
 *   wagmi's WalletClient satisfies this interface. We instantiate ExchangeClient
 *   at call-time with the connected wallet.
 *
 * Rules:
 * - Exact-amount ERC20 transfer (not approve) — bridge is a direct transfer.
 * - No approval needed for the bridge (plain USDC transfer).
 * - Never fake success.
 */

import { HttpTransport, InfoClient } from "@nktkas/hyperliquid";
import type { AbstractViemJsonRpcAccount } from "@nktkas/hyperliquid/signing";
import { readContract, waitForTransactionReceipt, writeContract } from "@wagmi/core";
import { useCallback, useRef, useState } from "react";
import { erc20Abi } from "viem";
import { useWalletClient } from "wagmi";
import { wagmiConfig } from "../wagmi/config";

// ─── Constants ────────────────────────────────────────────────────────────────

export const HLP_CHAIN_ID = 42161; // Arbitrum One — bridge is here
export const USDC_ARBITRUM = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" as const;

/**
 * Canonical Hyperliquid USDC bridge on Arbitrum.
 * Source: https://hyperliquid.gitbook.io/hyperliquid-docs/onboarding/deposit
 * This is a plain ERC20 transfer target — no calldata, no contract interaction.
 */
export const HL_BRIDGE = "0x2Df1c51E09aECF9cacB7bc98cB1742757f163dF7" as const;

/**
 * HLP vault address.
 * Source: /api/perp-vaults (already in the codebase) and HL docs.
 */
export const HLP_VAULT = "0xdfc24b077bc1425ad1dea75bcb6f8158e10df303" as const;

/** Minimum bridge amount per HL docs. */
export const HL_MIN_USDC = 5;

const CREDIT_POLL_INTERVAL_MS = 8_000;
const CREDIT_TIMEOUT_MS = 90_000;
const VAULT_POLL_INTERVAL_MS = 8_000;
const VAULT_TIMEOUT_MS = 60_000;

// ─── Types ────────────────────────────────────────────────────────────────────

export type HlpDepositStatus =
  | "idle"
  | "bridging"
  | "crediting"
  | "delegating"
  | "polling"
  | "success"
  | "unconfirmed"
  | "error";

export interface HlpDepositReceipt {
  bridgeTxHash: string;
  /** USD amount credited on HL (from vaultTransfer). */
  hlUsdAmount: number;
  /** Vault equity after delegation (null if polling timed out). */
  vaultEquity: string | null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useHlpDeposit(address?: `0x${string}`) {
  const { data: walletClient } = useWalletClient({ chainId: HLP_CHAIN_ID });

  const [status, setStatus] = useState<HlpDepositStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<HlpDepositReceipt | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  function abort() {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    return abortRef.current.signal;
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: abort is stable (useRef-backed)
  const execute = useCallback(
    async (params: {
      /** Raw USDC amount (6 decimals). */
      amountRaw: bigint;
      /** Human-readable USDC amount, used for vaultTransfer usd field (1e6 scaling). */
      amountHuman: number;
    }) => {
      if (!address) {
        setError("Connect wallet first");
        setStatus("error");
        return;
      }
      if (!walletClient) {
        setError("Switch to Arbitrum to continue");
        setStatus("error");
        return;
      }
      if (params.amountHuman < HL_MIN_USDC) {
        setError(`Minimum deposit is ${HL_MIN_USDC} USDC`);
        setStatus("error");
        return;
      }

      const signal = abort();
      setError(null);
      setReceipt(null);

      try {
        // ── Step 1: Bridge USDC to HL ──────────────────────────────────────
        //
        // This is a plain ERC20 transfer from the user's wallet to the HL bridge
        // contract on Arbitrum. No approval needed — we're transferring FROM
        // the user's own address. No calldata required.
        //
        setStatus("bridging");

        // Verify user has enough USDC first.
        const usdcBalance = (await readContract(wagmiConfig, {
          address: USDC_ARBITRUM,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [address],
          chainId: HLP_CHAIN_ID,
        })) as bigint;

        if (usdcBalance < params.amountRaw) {
          setError(
            `Insufficient USDC on Arbitrum. Have ${hlpUsdcRawToHuman(usdcBalance)}, need ${hlpUsdcRawToHuman(params.amountRaw)}.`,
          );
          setStatus("error");
          return;
        }

        const bridgeHash = await writeContract(wagmiConfig, {
          address: USDC_ARBITRUM,
          abi: erc20Abi,
          functionName: "transfer",
          args: [HL_BRIDGE, params.amountRaw],
          chainId: HLP_CHAIN_ID,
        });

        await waitForTransactionReceipt(wagmiConfig, {
          hash: bridgeHash,
          chainId: HLP_CHAIN_ID,
        });
        if (signal.aborted) return;

        // ── Step 2: Poll for HL account credit ────────────────────────────
        //
        // After the bridge tx confirms, the HL bridge credits the user's account
        // within ~60s. We poll the HL Info API (clearinghouseState) for the
        // user's withdrawal balance, waiting for it to increase.
        //
        setStatus("crediting");

        const hlTransport = new HttpTransport();
        const hlInfo = new InfoClient({ transport: hlTransport });

        const balanceBefore = await fetchHlBalance(hlInfo, address);
        const creditDeadline = Date.now() + CREDIT_TIMEOUT_MS;
        let balanceAfter = balanceBefore;

        while (Date.now() < creditDeadline && !signal.aborted) {
          await sleep(CREDIT_POLL_INTERVAL_MS);
          if (signal.aborted) return;
          balanceAfter = await fetchHlBalance(hlInfo, address);
          // Balance increased by at least half the deposit (accounting for rounding).
          if (balanceAfter - balanceBefore >= params.amountHuman * 0.9) break;
        }

        if (signal.aborted) return;

        // Proceed to delegation even if credit poll timed out (bridge tx confirmed on-chain).

        // ── Step 3: vaultTransfer to HLP ──────────────────────────────────
        //
        // The HL SDK's ExchangeClient.vaultTransfer signs an EIP-712 action on
        // the Hyperliquid L1. The wallet must implement AbstractViemJsonRpcAccount:
        //   signTypedData, getAddresses, getChainId
        // wagmi's WalletClient satisfies this.
        //
        // usd field = amount * 1e6 (HL's USD scaling for vault operations).
        //
        setStatus("delegating");

        // Instantiate ExchangeClient with the connected wagmi WalletClient.
        // wagmi's WalletClient satisfies AbstractViemJsonRpcAccount structurally:
        //   signTypedData ✓  getAddresses ✓  getChainId ✓
        // We cast because TypeScript can't structurally match the SDK interface
        // without explicit declaration, but the runtime shape is identical.
        const { ExchangeClient } = await import("@nktkas/hyperliquid");
        // wagmi WalletClient satisfies AbstractViemJsonRpcAccount structurally
        // (signTypedData, getAddresses, getChainId all present).

        const hlExchangeTyped = new ExchangeClient({
          transport: hlTransport,
          wallet: walletClient as unknown as AbstractViemJsonRpcAccount,
        });

        await hlExchangeTyped.vaultTransfer({
          vaultAddress: HLP_VAULT,
          isDeposit: true,
          // usd is amount * 1e6 per vaultTransfer.d.ts schema.
          usd: Math.round(params.amountHuman * 1_000_000),
        });
        if (signal.aborted) return;

        // ── Step 4: Poll vault equity ──────────────────────────────────────
        setStatus("polling");
        const equityBefore = await fetchHlVaultEquity(hlInfo, address);
        const vaultDeadline = Date.now() + VAULT_TIMEOUT_MS;
        let equityAfter = equityBefore;

        while (Date.now() < vaultDeadline && !signal.aborted) {
          await sleep(VAULT_POLL_INTERVAL_MS);
          if (signal.aborted) return;
          equityAfter = await fetchHlVaultEquity(hlInfo, address);
          if (equityAfter > equityBefore + params.amountHuman * 0.5) break;
        }

        if (signal.aborted) return;

        if (equityAfter <= equityBefore + params.amountHuman * 0.5) {
          setReceipt({
            bridgeTxHash: bridgeHash,
            hlUsdAmount: params.amountHuman,
            vaultEquity: null,
          });
          setStatus("unconfirmed");
          return;
        }

        setReceipt({
          bridgeTxHash: bridgeHash,
          hlUsdAmount: params.amountHuman,
          vaultEquity: equityAfter.toFixed(2),
        });
        setStatus("success");
      } catch (e) {
        if (signal.aborted) return;
        const msg =
          (e as { shortMessage?: string })?.shortMessage ??
          (e as Error)?.message ??
          "Deposit failed";
        setError(msg);
        setStatus("error");
      }
    },
    [address, walletClient],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus("idle");
    setError(null);
    setReceipt(null);
  }, []);

  return { status, error, receipt, execute, reset };
}

// ─── HL API helpers ───────────────────────────────────────────────────────────

async function fetchHlBalance(
  info: InstanceType<typeof InfoClient>,
  user: `0x${string}`,
): Promise<number> {
  try {
    const state = await info.clearinghouseState({ user });
    return Number.parseFloat(state.withdrawable ?? "0");
  } catch {
    return 0;
  }
}

async function fetchHlVaultEquity(
  info: InstanceType<typeof InfoClient>,
  user: `0x${string}`,
): Promise<number> {
  try {
    const equities = await info.userVaultEquities({ user });
    const hlp = equities.find((e) => e.vaultAddress.toLowerCase() === HLP_VAULT.toLowerCase());
    return hlp ? Number.parseFloat(hlp.equity) : 0;
  } catch {
    return 0;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Pure helpers (exported for tests) ────────────────────────────────────────

/** Convert raw USDC (6 dec) to human string. */
export function hlpUsdcRawToHuman(raw: bigint): string {
  const whole = raw / 1_000_000n;
  const frac = raw % 1_000_000n;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(6, "0").replace(/0+$/, "");
  return `${whole}.${fracStr}`;
}

/** Convert human USDC string to raw bigint (6 dec). Throws on invalid input. */
export function hlpUsdcHumanToRaw(human: string): bigint {
  const trimmed = human.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) throw new Error("Invalid USDC amount");
  const parts = trimmed.split(".");
  const whole = parts[0] ?? "0";
  const frac = parts[1] ?? "";
  const fracPadded = frac.slice(0, 6).padEnd(6, "0");
  return BigInt(whole) * 1_000_000n + BigInt(fracPadded);
}

/** Validate HLP deposit amount. */
export function validateHlpDepositAmount(amountUsdc: number): string | null {
  if (!Number.isFinite(amountUsdc) || amountUsdc <= 0) return "Enter a valid amount";
  if (amountUsdc < HL_MIN_USDC) return `Minimum deposit is ${HL_MIN_USDC} USDC`;
  return null;
}
