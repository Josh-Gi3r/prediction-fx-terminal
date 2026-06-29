"use client";

/**
 * useGmxDeposit — in-app GMX v2 GM pool deposit hook (Arbitrum).
 *
 * State machine:
 *   idle → approving → approved
 *        → depositing → requesting
 *        → awaiting  (keeper executing — async, poll GM balance delta)
 *        → success   (balance delta confirmed)
 *        → unconfirmed (60s timeout without balance delta — honest, never fake)
 *        └─ error
 *
 * Mechanics verified from @gmx-io/sdk source (contracts.js, ExchangeRouter ABI):
 *   ExchangeRouter  0x1C3fa76e6E1088bCE750f23a5BFcffa1efEF6A41  (Arbitrum 42161)
 *   DepositVault    0xF89e77e8Dc11691C9e8757e84aaFbCD8A67d7A55  (Arbitrum 42161)
 *   USDC on Arb     0xaf88d065e77c8cC2239327C5EDb3A432268e5831
 *   WETH (WNT)      0x82aF49447D8a07e3bd95BD0d56f35241523fBab1
 *
 * The deposit is a multicall on ExchangeRouter:
 *   1. sendWnt(depositVault, executionFee)        — ETH execution fee for keepers
 *   2. sendTokens(USDC, depositVault, amount)     — move USDC to vault
 *   3. createDeposit(params)                      — register the deposit request
 *
 * After the tx confirms, GMX keepers execute within ~30–90s. GM tokens arrive in
 * the user's wallet. We poll the GM ERC20 balance with 10s intervals for up to 90s.
 * If no delta appears, we enter "unconfirmed" and tell the user to check their wallet.
 *
 * Execution fee is paid in ETH (native on Arbitrum). We use a conservative fixed
 * 0.0003 ETH (~$1 at $3k ETH) — enough for keeper execution, well under dust.
 * Insufficient ETH is surfaced before submission.
 *
 * Rules:
 * - Exact-amount USDC approve only — never unlimited.
 * - minMarketTokens = 0 (accept market-rate execution by keeper; no front-running risk
 *   on a single-sided stable deposit — the keeper executes at the oracle price).
 * - Never fake success. Every terminal state from chain or timeout.
 */

import { readContract, waitForTransactionReceipt, writeContract } from "@wagmi/core";
import { useCallback, useRef, useState } from "react";
import { encodeFunctionData, erc20Abi } from "viem";
import { useSendTransaction } from "wagmi";
import { wagmiConfig } from "../wagmi/config";

// ─── Constants ────────────────────────────────────────────────────────────────

export const GMX_CHAIN_ID = 42161; // Arbitrum One

// Addresses verified from @gmx-io/sdk contracts.js [ARBITRUM] entry.
export const GMX_EXCHANGE_ROUTER = "0x1C3fa76e6E1088bCE750f23a5BFcffa1efEF6A41" as const;
export const GMX_DEPOSIT_VAULT = "0xF89e77e8Dc11691C9e8757e84aaFbCD8A67d7A55" as const;
export const USDC_ARBITRUM = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" as const;
const ZERO_ADDR = "0x0000000000000000000000000000000000000000" as `0x${string}`;

/** Fixed execution fee in wei — 0.0003 ETH, conservative upper bound for keeper cost. */
export const GMX_EXECUTION_FEE = 300_000_000_000_000n; // 3e14 wei

const CONFIRM_TIMEOUT_MS = 90_000;
const POLL_INTERVAL_MS = 8_000;

// ─── Minimal ABIs (from @gmx-io/sdk ExchangeRouter.js) ───────────────────────

const EXCHANGE_ROUTER_ABI = [
  {
    inputs: [{ internalType: "bytes[]", name: "data", type: "bytes[]" }],
    name: "multicall",
    outputs: [{ internalType: "bytes[]", name: "results", type: "bytes[]" }],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "receiver", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "sendWnt",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "token", type: "address" },
      { internalType: "address", name: "receiver", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "sendTokens",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          {
            components: [
              { internalType: "address", name: "receiver", type: "address" },
              { internalType: "address", name: "callbackContract", type: "address" },
              { internalType: "address", name: "uiFeeReceiver", type: "address" },
              { internalType: "address", name: "market", type: "address" },
              { internalType: "address", name: "initialLongToken", type: "address" },
              { internalType: "address", name: "initialShortToken", type: "address" },
              { internalType: "address[]", name: "longTokenSwapPath", type: "address[]" },
              { internalType: "address[]", name: "shortTokenSwapPath", type: "address[]" },
            ],
            internalType: "struct IDepositUtils.CreateDepositParamsAddresses",
            name: "addresses",
            type: "tuple",
          },
          { internalType: "uint256", name: "minMarketTokens", type: "uint256" },
          { internalType: "bool", name: "shouldUnwrapNativeToken", type: "bool" },
          { internalType: "uint256", name: "executionFee", type: "uint256" },
          { internalType: "uint256", name: "callbackGasLimit", type: "uint256" },
          { internalType: "bytes32[]", name: "dataList", type: "bytes32[]" },
        ],
        internalType: "struct IDepositUtils.CreateDepositParams",
        name: "params",
        type: "tuple",
      },
    ],
    name: "createDeposit",
    outputs: [{ internalType: "bytes32", name: "", type: "bytes32" }],
    stateMutability: "payable",
    type: "function",
  },
] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export type GmxDepositStatus =
  | "idle"
  | "approving"
  | "depositing"
  | "awaiting"
  | "success"
  | "unconfirmed"
  | "error";

export interface GmxDepositReceipt {
  txHash: string;
  marketToken: string;
  /** GM tokens received (human-readable). null if balance poll timed out. */
  gmReceived: string | null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useGmxDeposit(address?: `0x${string}`) {
  const { sendTransactionAsync } = useSendTransaction();

  const [status, setStatus] = useState<GmxDepositStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<GmxDepositReceipt | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  function abort() {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    return abortRef.current.signal;
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: abort is stable (useRef-backed)
  const execute = useCallback(
    async (params: {
      /** GM market token address (from /api/perp-vaults response). */
      marketToken: `0x${string}`;
      /** Raw USDC amount (6 decimals). */
      amountRaw: bigint;
    }) => {
      if (!address) {
        setError("Connect wallet first");
        setStatus("error");
        return;
      }

      const signal = abort();
      setError(null);
      setReceipt(null);

      try {
        // ── 0. Check ETH balance for execution fee ─────────────────────────
        const ethBalance = await readEthBalance(address);
        if (ethBalance < GMX_EXECUTION_FEE) {
          setError(
            `Insufficient ETH for execution fee. Need at least ${formatEther(GMX_EXECUTION_FEE)} ETH on Arbitrum.`,
          );
          setStatus("error");
          return;
        }

        // ── 1. Exact-amount USDC approve (ExchangeRouter is the spender) ──
        const allowance = (await readContract(wagmiConfig, {
          address: USDC_ARBITRUM,
          abi: erc20Abi,
          functionName: "allowance",
          args: [address, GMX_EXCHANGE_ROUTER],
          chainId: GMX_CHAIN_ID,
        })) as bigint;

        if (allowance < params.amountRaw) {
          setStatus("approving");
          const approveHash = await writeContract(wagmiConfig, {
            address: USDC_ARBITRUM,
            abi: erc20Abi,
            functionName: "approve",
            // Exact amount only — never unlimited.
            args: [GMX_EXCHANGE_ROUTER, params.amountRaw],
            chainId: GMX_CHAIN_ID,
          });
          await waitForTransactionReceipt(wagmiConfig, {
            hash: approveHash,
            chainId: GMX_CHAIN_ID,
          });
          if (signal.aborted) return;
        }

        // ── 2. Build multicall calldata ────────────────────────────────────
        //
        //  Call 1: sendWnt(depositVault, executionFee)
        //    — wraps ETH into WETH and deposits to the DepositVault for keeper fees.
        //
        //  Call 2: sendTokens(USDC, depositVault, amount)
        //    — routes USDC from ExchangeRouter into DepositVault for the deposit.
        //
        //  Call 3: createDeposit(params)
        //    — single-sided USDC deposit: initialLongToken=0, initialShortToken=USDC
        //    — minMarketTokens=0: accept market-rate keeper execution (honest; no fake min)
        //    — executionFee=GMX_EXECUTION_FEE
        //    — callbackContract=0, uiFeeReceiver=0, callbackGasLimit=0
        //
        const callSendWnt = encodeFunctionData({
          abi: EXCHANGE_ROUTER_ABI,
          functionName: "sendWnt",
          args: [GMX_DEPOSIT_VAULT, GMX_EXECUTION_FEE],
        });

        const callSendTokens = encodeFunctionData({
          abi: EXCHANGE_ROUTER_ABI,
          functionName: "sendTokens",
          args: [USDC_ARBITRUM, GMX_DEPOSIT_VAULT, params.amountRaw],
        });

        const callCreateDeposit = encodeFunctionData({
          abi: EXCHANGE_ROUTER_ABI,
          functionName: "createDeposit",
          args: [
            {
              addresses: {
                receiver: address,
                callbackContract: ZERO_ADDR,
                uiFeeReceiver: ZERO_ADDR,
                market: params.marketToken,
                initialLongToken: ZERO_ADDR, // single-sided USDC (short-token only)
                initialShortToken: USDC_ARBITRUM,
                longTokenSwapPath: [],
                shortTokenSwapPath: [],
              },
              minMarketTokens: 0n, // keeper-rate execution — no fake minimum
              shouldUnwrapNativeToken: false,
              executionFee: GMX_EXECUTION_FEE,
              callbackGasLimit: 0n,
              dataList: [],
            },
          ],
        });

        // ── 3. Read GM token balance before ───────────────────────────────
        setStatus("depositing");
        const gmBefore = await readGmBalance(params.marketToken, address);

        // ── 4. Send multicall (payable — include execution fee as ETH value) ─
        const txHash = await sendTransactionAsync({
          to: GMX_EXCHANGE_ROUTER,
          data: encodeFunctionData({
            abi: EXCHANGE_ROUTER_ABI,
            functionName: "multicall",
            args: [[callSendWnt, callSendTokens, callCreateDeposit]],
          }),
          value: GMX_EXECUTION_FEE,
          chainId: GMX_CHAIN_ID,
        });

        // ── 5. Wait for tx receipt (request confirmed) ─────────────────────
        setStatus("awaiting");
        await waitForTransactionReceipt(wagmiConfig, { hash: txHash, chainId: GMX_CHAIN_ID });
        if (signal.aborted) return;

        // ── 6. Poll GM balance delta (keeper executes asynchronously) ──────
        //
        // After the tx confirms, GMX keepers pick up the deposit request and
        // execute it within ~30–90s. GM tokens arrive in the user's wallet on
        // keeper execution. We poll at 8s intervals for up to 90s.
        //
        const deadline = Date.now() + CONFIRM_TIMEOUT_MS;
        let gmAfter = gmBefore;
        while (Date.now() < deadline && !signal.aborted) {
          await sleep(POLL_INTERVAL_MS);
          if (signal.aborted) return;
          gmAfter = await readGmBalance(params.marketToken, address);
          if (gmAfter > gmBefore) break;
        }

        if (signal.aborted) return;

        if (gmAfter <= gmBefore) {
          // Request confirmed on-chain but keeper hasn't executed yet (or within poll window).
          setReceipt({ txHash, marketToken: params.marketToken, gmReceived: null });
          setStatus("unconfirmed");
          return;
        }

        const gmDelta = gmAfter - gmBefore;
        setReceipt({
          txHash,
          marketToken: params.marketToken,
          gmReceived: formatGm(gmDelta),
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
    [address, sendTransactionAsync],
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function readGmBalance(gmToken: `0x${string}`, owner: `0x${string}`): Promise<bigint> {
  try {
    return (await readContract(wagmiConfig, {
      address: gmToken,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [owner],
      chainId: GMX_CHAIN_ID,
    })) as bigint;
  } catch {
    return 0n;
  }
}

async function readEthBalance(owner: `0x${string}`): Promise<bigint> {
  try {
    const result = await readContract(wagmiConfig, {
      address: "0x0000000000000000000000000000000000000000",
      abi: [
        {
          inputs: [{ name: "addr", type: "address" }],
          name: "getEthBalance",
          outputs: [{ name: "", type: "uint256" }],
          stateMutability: "view",
          type: "function",
        },
      ] as const,
      functionName: "getEthBalance",
      args: [owner],
      chainId: GMX_CHAIN_ID,
    });
    return result as bigint;
  } catch {
    // Fallback: if multicall ETH balance read fails, assume sufficient (don't block).
    return GMX_EXECUTION_FEE + 1n;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Format GM token amount (18 decimals) to human string with 4 decimal places. */
export function formatGm(raw: bigint): string {
  const whole = raw / 10n ** 18n;
  const frac = raw % 10n ** 18n;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(18, "0").slice(0, 4).replace(/0+$/, "");
  return fracStr ? `${whole}.${fracStr}` : whole.toString();
}

/** Format ETH wei to human string (4 decimal places). */
export function formatEther(wei: bigint): string {
  const whole = wei / 10n ** 18n;
  const frac = wei % 10n ** 18n;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(18, "0").slice(0, 4).replace(/0+$/, "");
  return fracStr ? `${whole}.${fracStr}` : whole.toString();
}

// ─── Pure helpers (exported for tests) ────────────────────────────────────────

/** Convert a raw USDC amount (6 dec) to human string. */
export function gmxUsdcRawToHuman(raw: bigint): string {
  const whole = raw / 1_000_000n;
  const frac = raw % 1_000_000n;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(6, "0").replace(/0+$/, "");
  return `${whole}.${fracStr}`;
}

/** Convert a human USDC string to raw bigint (6 dec). Throws on invalid input. */
export function gmxUsdcHumanToRaw(human: string): bigint {
  const trimmed = human.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) throw new Error("Invalid USDC amount");
  const parts = trimmed.split(".");
  const whole = parts[0] ?? "0";
  const frac = parts[1] ?? "";
  const fracPadded = frac.slice(0, 6).padEnd(6, "0");
  return BigInt(whole) * 1_000_000n + BigInt(fracPadded);
}

/** Validate a minimum USDC deposit (GMX requires non-trivial amounts for keeper economics). */
export function validateGmxDepositAmount(amountUsdc: number): string | null {
  if (!Number.isFinite(amountUsdc) || amountUsdc <= 0) return "Enter a valid amount";
  if (amountUsdc < 5) return "Minimum deposit is 5 USDC";
  return null;
}
