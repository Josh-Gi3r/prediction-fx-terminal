"use client";

/**
 * lib/polymarket/useUsdcApproval.ts
 *
 * Manages USDC.e approval for Polymarket betting on Polygon.
 *
 * Token: USDC.e (bridged) 0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174 (6 decimals)
 *
 * Exact-amount approvals only -- never approves more than needed for the
 * current bet. This matches the pattern in components/peer/SellPanel.tsx.
 *
 * After a successful on-chain approval, calls
 * client.updateBalanceAllowance({asset_type: AssetType.COLLATERAL}) so the
 * CLOB recognises the new allowance before postOrder.
 */

import { AssetType } from "@polymarket/clob-client";
import type { ClobClient } from "@polymarket/clob-client";
import { useCallback, useState } from "react";
import { http, createPublicClient, erc20Abi } from "viem";
import type { WalletClient } from "viem";
import { polygon } from "wagmi/chains";
import { usdcToRaw } from "./order";

// USDC.e (bridged USDC) on Polygon -- the only collateral Polymarket accepts.
export const USDC_E_POLYGON = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174" as const;
export const USDC_DECIMALS = 6;

// Re-export for consumers that import from this module.
export { usdcToRaw };

const POLYGON_RPC =
  typeof process !== "undefined"
    ? (process.env.NEXT_PUBLIC_POLYGON_RPC ?? "https://polygon-bor-rpc.publicnode.com")
    : "https://polygon-bor-rpc.publicnode.com";

function getPublicClient() {
  return createPublicClient({
    chain: polygon,
    transport: http(POLYGON_RPC),
  });
}

export interface UsdcApprovalState {
  /** Raw balance (6 decimals). null while loading. */
  balance: bigint | null;
  /** Raw current allowance for spender (6 decimals). null while loading. */
  allowance: bigint | null;
  /**
   * True once the on-chain allowance has been fetched at least once.
   * Gates the bet button: do not allow betting until this is true, because
   * needsApproval is false while allowance===null (loading) which would
   * incorrectly unblock the bet path.
   */
  allowanceKnown: boolean;
  /** True if allowance < costRawUsdc. Always false while allowance is null. */
  needsApproval: boolean;
  /** Call to send an exact-amount approve tx. */
  approve: () => Promise<void>;
  /** True while the approve tx is in flight. */
  approving: boolean;
  /** Error message if approve failed. */
  error: string | null;
  /** Refresh balance + allowance from chain. */
  refresh: () => Promise<void>;
}

/**
 * Read and manage USDC.e approval for a given spender on Polygon.
 *
 * @param walletClient  Viem WalletClient on Polygon. Pass null when no wallet
 *                      is connected -- hook returns safe defaults.
 * @param spender       Contract that needs the allowance (CTF Exchange address).
 * @param costRawUsdc   Cost of the bet in raw USDC.e units (6 decimals).
 * @param clobClient    Optional -- if provided, updateBalanceAllowance is called
 *                      after a successful on-chain approval.
 */
export function useUsdcApproval(
  walletClient: WalletClient | null,
  spender: `0x${string}`,
  costRawUsdc: bigint,
  clobClient?: ClobClient | null,
): UsdcApprovalState {
  const [balance, setBalance] = useState<bigint | null>(null);
  const [allowance, setAllowance] = useState<bigint | null>(null);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const owner = walletClient?.account?.address ?? null;

  const refresh = useCallback(async () => {
    if (!owner) {
      setBalance(null);
      setAllowance(null);
      return;
    }
    const publicClient = getPublicClient();
    const [rawBal, rawAllowance] = await Promise.all([
      publicClient.readContract({
        address: USDC_E_POLYGON,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [owner],
      }),
      publicClient.readContract({
        address: USDC_E_POLYGON,
        abi: erc20Abi,
        functionName: "allowance",
        args: [owner, spender],
      }),
    ]);
    setBalance(rawBal as bigint);
    setAllowance(rawAllowance as bigint);
  }, [owner, spender]);

  const approve = useCallback(async () => {
    if (!walletClient || !owner) {
      setError("Wallet not connected");
      return;
    }
    setApproving(true);
    setError(null);
    try {
      const publicClient = getPublicClient();

      const hash = await walletClient.writeContract({
        address: USDC_E_POLYGON,
        abi: erc20Abi,
        functionName: "approve",
        args: [spender, costRawUsdc],
        account: owner,
        chain: polygon,
      });

      await publicClient.waitForTransactionReceipt({ hash });

      // Inform the CLOB about the new allowance so it doesn't reject postOrder.
      if (clobClient) {
        try {
          await clobClient.updateBalanceAllowance({ asset_type: AssetType.COLLATERAL });
        } catch {
          // Non-fatal -- the on-chain approval is what matters.
        }
      }

      await refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setApproving(false);
    }
  }, [walletClient, owner, spender, costRawUsdc, clobClient, refresh]);

  // allowanceKnown is true once we have a real on-chain read. While null
  // (initial load or no wallet), we must NOT unblock the bet button.
  const allowanceKnown = allowance !== null;
  // needsApproval is false while loading (allowance===null) -- this is
  // intentionally conservative: callers must also gate on allowanceKnown.
  const needsApproval = allowanceKnown && allowance < costRawUsdc;

  return { balance, allowance, allowanceKnown, needsApproval, approve, approving, error, refresh };
}
