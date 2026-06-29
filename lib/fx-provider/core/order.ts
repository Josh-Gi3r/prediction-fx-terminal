// EIP-712 Order signing for FX Provider maker orders (limit orders + VL legs).
// Types lifted from FX provider market-maker order-signer
// (working production code). Signed under the SAME FX Provider domain as Intent.
import type { FxConfig } from "./types";

export interface OrderStruct {
  user: `0x${string}`;
  expiration: number; // uint48
  feeBps: number; // uint48 (contract bps — usually 0 for makers; denom 10^14)
  recipient: `0x${string}`; // address(0) keeps proceeds in vault ledger
  fromToken: `0x${string}`; // BASE token (market spec)
  toToken: `0x${string}`; // QUOTE token (market spec)
  fromAmount: bigint; // raw units
  toAmount: bigint; // raw units
  initialDepositAmount: bigint; // 0 for vault-funded (the VL pattern)
  uuid: bigint; // composite uuid_int
}

export const ORDER_TYPES = {
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

export interface OrderTypedData {
  domain: { name: string; version: string; chainId: number; verifyingContract: `0x${string}` };
  types: typeof ORDER_TYPES;
  primaryType: "Order";
  message: {
    user: `0x${string}`;
    expiration: bigint;
    feeBps: bigint;
    recipient: `0x${string}`;
    fromToken: `0x${string}`;
    toToken: `0x${string}`;
    fromAmount: bigint;
    toAmount: bigint;
    initialDepositAmount: bigint;
    uuid: bigint;
  };
}

/** Build the viem/wagmi `signTypedData` payload for an Order. uint fields → bigint. */
export function buildOrderTypedData(
  order: OrderStruct,
  config: Pick<FxConfig, "chain_id" | "settlement_address">,
): OrderTypedData {
  return {
    domain: {
      name: process.env.NEXT_PUBLIC_EIP712_DOMAIN_NAME ?? "FX Provider", // Replace with your provider's EIP-712 domain name
      version: "1",
      chainId: config.chain_id,
      verifyingContract: config.settlement_address as `0x${string}`,
    },
    types: ORDER_TYPES,
    primaryType: "Order",
    message: {
      user: order.user,
      expiration: BigInt(order.expiration),
      feeBps: BigInt(order.feeBps),
      recipient: order.recipient,
      fromToken: order.fromToken,
      toToken: order.toToken,
      fromAmount: order.fromAmount,
      toAmount: order.toAmount,
      initialDepositAmount: order.initialDepositAmount,
      uuid: order.uuid,
    },
  };
}

/** CancelVLBatch EIP-712 struct. Authoritative shape lifted from FX providerFX production
 * (fx-provider-api-config): vlBatchId is a STRING (the UUID4
 * order_id of the batch's first/primary leg), NOT uint256. */
export const CANCEL_VL_BATCH_TYPES = {
  CancelVLBatch: [
    { name: "owner", type: "address" },
    { name: "vlBatchId", type: "string" },
  ],
} as const;

export function buildCancelVlBatchTypedData(
  owner: `0x${string}`,
  vlBatchId: string,
  config: Pick<FxConfig, "chain_id" | "settlement_address">,
) {
  return {
    domain: {
      name: process.env.NEXT_PUBLIC_EIP712_DOMAIN_NAME ?? "FX Provider", // Replace with your provider's EIP-712 domain name
      version: "1",
      chainId: config.chain_id,
      verifyingContract: config.settlement_address as `0x${string}`,
    },
    types: CANCEL_VL_BATCH_TYPES,
    primaryType: "CancelVLBatch" as const,
    message: { owner, vlBatchId },
  };
}
