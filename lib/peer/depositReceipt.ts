/**
 * lib/peer/depositReceipt.ts
 *
 * Resolves the on-chain depositId from the createDeposit tx hash by parsing
 * the DepositReceived event out of the receipt logs.
 *
 * DepositReceived event (v1 + v2 ABI, both identical shape):
 *   event DepositReceived(
 *     uint256 indexed depositId,
 *     address indexed depositor,
 *     address indexed token,
 *     uint256 amount,
 *     Range   intentAmountRange,
 *     address delegate,
 *     address intentGuardian
 *   )
 *
 * Strategy:
 *   1. waitForTransactionReceipt via @wagmi/core (same pattern as hlpDeposit.ts)
 *   2. parseEventLogs against client.escrowAbi / client.escrowV2Abi
 *   3. Filter args.depositor === depositor (case-insensitive)
 *   4. Return args.depositId as bigint, or null when nothing matches
 *
 * Never makes a network call beyond the receipt fetch — no additional RPC reads.
 */

import { waitForTransactionReceipt } from "@wagmi/core";
import type { Zkp2pClient } from "@zkp2p/sdk";
import { parseEventLogs } from "viem";
import { wagmiConfig } from "../wagmi/config";
import { PEER_CHAIN_ID } from "./config";

/**
 * Resolves the depositId emitted in DepositReceived for a given createDeposit
 * transaction.
 *
 * @param client   - Zkp2pClient (exposes escrowAbi + optional escrowV2Abi)
 * @param hash     - Transaction hash returned by createDeposit
 * @param depositor - The depositor address (wallet that signed the tx)
 * @returns        depositId as bigint, or null when the event cannot be found
 */
export async function resolveDepositIdFromReceipt(
  client: Zkp2pClient,
  hash: `0x${string}`,
  depositor: `0x${string}`,
): Promise<bigint | null> {
  let receipt: Awaited<ReturnType<typeof waitForTransactionReceipt>>;
  try {
    receipt = await waitForTransactionReceipt(wagmiConfig, {
      hash,
      chainId: PEER_CHAIN_ID,
    });
  } catch {
    return null;
  }

  const depositorLower = depositor.toLowerCase();

  // Try primary escrow ABI first
  try {
    const logs = parseEventLogs({
      abi: client.escrowAbi,
      logs: receipt.logs,
      eventName: "DepositReceived",
    });

    for (const log of logs) {
      const args = log.args as {
        depositId?: bigint;
        depositor?: string;
      };
      if (
        args.depositId !== undefined &&
        typeof args.depositor === "string" &&
        args.depositor.toLowerCase() === depositorLower
      ) {
        return args.depositId;
      }
    }
  } catch {
    // ABI mismatch or no matching event — fall through to v2
  }

  // Fallback: try escrowV2Abi when present
  if (client.escrowV2Abi) {
    try {
      const logsV2 = parseEventLogs({
        abi: client.escrowV2Abi,
        logs: receipt.logs,
        eventName: "DepositReceived",
      });

      for (const log of logsV2) {
        const args = log.args as {
          depositId?: bigint;
          depositor?: string;
        };
        if (
          args.depositId !== undefined &&
          typeof args.depositor === "string" &&
          args.depositor.toLowerCase() === depositorLower
        ) {
          return args.depositId;
        }
      }
    } catch {
      // escrowV2Abi also produced no match
    }
  }

  return null;
}
