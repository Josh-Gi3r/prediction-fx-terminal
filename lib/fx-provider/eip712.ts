/**
 * EIP-712 typed-data structures and helpers for FX Provider signing flows.
 *
 * The domain is the live FX Provider contract on the active chain; fetch it from
 * `/config` (`eip712_domain`) rather than hardcoding addresses.
 */

import type { Address } from "./types";

export interface FxProviderDomain {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: Address;
}

/**
 * Order struct (limit orders).
 * Note: signed `uuid` is the composite uint256 (see `encodeStandaloneUuid`),
 * not the human-readable UUID string.
 */
export const OrderTypes = {
  Order: [
    { name: "user", type: "address" },
    { name: "expiration", type: "uint48" },
    { name: "feeBps", type: "uint48" },
    { name: "recipient", type: "address" },
    { name: "fromToken", type: "address" },
    { name: "toToken", type: "address" },
    { name: "fromAmount", type: "uint256" },
    { name: "toAmount", type: "uint256" },
    { name: "initialDepositAmount", type: "uint256" },
    { name: "uuid", type: "uint256" },
  ],
} as const;

/** Intent struct (swaps). */
export const IntentTypes = {
  Intent: [
    { name: "taker", type: "address" },
    { name: "inputToken", type: "address" },
    { name: "outputToken", type: "address" },
    { name: "maxInputAmount", type: "uint256" },
    { name: "minOutputAmount", type: "uint256" },
    { name: "recipient", type: "address" },
    { name: "initialDepositAmount", type: "uint256" },
    { name: "uuid", type: "uint256" },
    { name: "deadline", type: "uint48" },
  ],
} as const;

/** Cancel a single order. `orderId` is the composite uint256. */
export const CancelOrderTypes = {
  CancelOrder: [
    { name: "owner", type: "address" },
    { name: "orderId", type: "uint256" },
  ],
} as const;

/** Cancel an entire VL batch. `vlBatchId` is the primary order_id string. */
export const CancelVLBatchTypes = {
  CancelVLBatch: [
    { name: "owner", type: "address" },
    { name: "vlBatchId", type: "string" },
  ],
} as const;

export const WithdrawIntentTypes = {
  WithdrawIntent: [
    { name: "user", type: "address" },
    { name: "tokens", type: "address[]" },
    { name: "amounts", type: "uint256[]" },
    { name: "recipient", type: "address" },
    { name: "deadline", type: "uint256" },
    { name: "uuid", type: "uint256" },
  ],
} as const;

export const ManageApiKeyTypes = {
  ManageApiKey: [
    { name: "owner", type: "address" },
    { name: "action", type: "string" },
    { name: "timestamp", type: "uint256" },
  ],
} as const;

// ============================================================
// UUID composite encoding
//
// FX Provider embeds the human-readable UUID4 plus an executor_id and a leg_id
// into a single uint256:
//   [255:252] executor_id | [251:124] full UUID4 bits | [123:12] group_id | [11:0] leg_id
// ============================================================

function uuidStringToBigInt(uuid: string): bigint {
  return BigInt(`0x${uuid.replace(/-/g, "")}`);
}

/** Build the composite uuid_int for a standalone limit order. */
export function encodeStandaloneUuid(orderId: string, executorId: number): string {
  const raw = uuidStringToBigInt(orderId);
  const group = raw >> 16n;
  return ((BigInt(executorId) << 252n) | (raw << 124n) | (group << 12n)).toString();
}

/** Build the composite uuid_int for a VL batch sibling. */
export function encodeVlUuid(
  orderId: string,
  executorId: number,
  legId: number,
  groupOrderId: string,
): string {
  const raw = uuidStringToBigInt(orderId);
  const group = uuidStringToBigInt(groupOrderId) >> 16n;
  return ((BigInt(executorId) << 252n) | (raw << 124n) | (group << 12n) | BigInt(legId)).toString();
}
