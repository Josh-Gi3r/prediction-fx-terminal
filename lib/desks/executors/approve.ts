// Shared ERC-20 exact-approve flow used by Kyber and CoW executors.
// Pure async — no React state. Callers handle setApproval / setStatus.
import { readContract, waitForTransactionReceipt, writeContract } from "@wagmi/core";
import { erc20Abi } from "viem";
import type { Address } from "viem";
import { wagmiConfig } from "../../wagmi/config";
import type { ApprovalDetail } from "../useSwap";

export interface ApproveCallbacks {
  onApprovalNeeded: (detail: ApprovalDetail) => void;
  onApprovalDone: () => void;
}

/**
 * Check allowance; if insufficient, approve exactly `amount` and wait for
 * the receipt. Fires callbacks so the hook can update React state.
 */
export async function ensureAllowance(
  token: Address,
  spender: Address,
  amount: bigint,
  owner: Address,
  callbacks: ApproveCallbacks,
): Promise<void> {
  const allowance = (await readContract(wagmiConfig, {
    address: token,
    abi: erc20Abi,
    functionName: "allowance",
    args: [owner, spender],
  })) as bigint;

  if (allowance >= amount) return;

  const chainId = wagmiConfig.state.chainId;
  callbacks.onApprovalNeeded({
    token,
    spender,
    amountRaw: amount.toString(),
    chainId,
  });

  const approveHash = await writeContract(wagmiConfig, {
    address: token,
    abi: erc20Abi,
    functionName: "approve",
    args: [spender, amount],
  });
  await waitForTransactionReceipt(wagmiConfig, { hash: approveHash });
  callbacks.onApprovalDone();
}

/**
 * Exact approval amount for Kyber path.
 * Exported from here and re-exported through useSwap for unit tests.
 */
export function kyberApprovalAmount(amountInRaw: string): bigint {
  return BigInt(amountInRaw);
}

/**
 * Exact approval amount for CoW path.
 * CoW requires sellAmount + feeAmount approved to the RELAYER.
 */
export function cowApprovalAmount(sellAmount: string, feeAmount: string): bigint {
  return BigInt(sellAmount) + BigInt(feeAmount);
}
