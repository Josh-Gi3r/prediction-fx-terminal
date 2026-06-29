// Shared primitives used across all venue executors.
// No React imports — pure async utilities.
import { readContract } from "@wagmi/core";
import { erc20Abi } from "viem";
import { wagmiConfig } from "../../wagmi/config";

export const POLL_INTERVAL_MS = 4_000;
export const CONFIRM_TIMEOUT_MS = 90_000;

export async function readBalanceOf(
  tokenAddress: `0x${string}`,
  owner: `0x${string}`,
): Promise<bigint> {
  if (!tokenAddress || tokenAddress === "0x") return 0n;
  try {
    return (await readContract(wagmiConfig, {
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [owner],
    })) as bigint;
  } catch {
    return 0n;
  }
}

export function formatTokenAmount(raw: bigint, decimals: number): string {
  if (decimals <= 0) return raw.toString();
  const divisor = 10n ** BigInt(decimals);
  const whole = raw / divisor;
  const frac = raw % divisor;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${whole}.${fracStr}`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Placeholder reverse-lookup: returns null (callers fall back to "tokens"). */
export function getSymbolFromAddress(_address: string): string | null {
  return null;
}
