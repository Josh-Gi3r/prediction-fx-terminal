// EIP-712 Intent signing. Types lifted verbatim from FX provider-mcp src/signer/signer.ts
// (INTENT_TYPES, 2026-05-29). Field order MUST match the contract's struct hash.
import type { PermitEnvelope, FxConfig, FxIntent } from "./types";

export const INTENT_TYPES = {
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

export interface IntentTypedData {
  domain: { name: string; version: string; chainId: number; verifyingContract: `0x${string}` };
  types: typeof INTENT_TYPES;
  primaryType: "Intent";
  message: {
    taker: `0x${string}`;
    inputToken: `0x${string}`;
    outputToken: `0x${string}`;
    maxInputAmount: bigint;
    minOutputAmount: bigint;
    recipient: `0x${string}`;
    initialDepositAmount: bigint;
    uuid: bigint;
    deadline: bigint;
  };
}

/** Build the viem/wagmi `signTypedData` payload from a quote's route_params.
 * uint fields are coerced to bigint (viem requirement); addresses pass through. */
export function buildIntentTypedData(
  routeParams: FxIntent,
  config: Pick<FxConfig, "chain_id" | "settlement_address">,
): IntentTypedData {
  return {
    domain: {
      name: process.env.NEXT_PUBLIC_EIP712_DOMAIN_NAME ?? "FX Provider", // Replace with your provider's EIP-712 domain name
      version: "1",
      chainId: config.chain_id,
      verifyingContract: config.settlement_address as `0x${string}`,
    },
    types: INTENT_TYPES,
    primaryType: "Intent",
    message: {
      taker: routeParams.taker as `0x${string}`,
      inputToken: routeParams.inputToken as `0x${string}`,
      outputToken: routeParams.outputToken as `0x${string}`,
      maxInputAmount: BigInt(routeParams.maxInputAmount),
      minOutputAmount: BigInt(routeParams.minOutputAmount),
      recipient: routeParams.recipient as `0x${string}`,
      initialDepositAmount: BigInt(routeParams.initialDepositAmount),
      uuid: BigInt(routeParams.uuid),
      deadline: BigInt(routeParams.deadline),
    },
  };
}

/** The quote already returns a ready-to-sign permit.eip712 object; coerce its
 * message uint fields to bigint for viem. */
export function buildPermitTypedData(permit: PermitEnvelope) {
  const e = permit.eip712;
  return {
    domain: {
      name: e.domain.name,
      version: e.domain.version,
      chainId: e.domain.chainId,
      verifyingContract: e.domain.verifyingContract as `0x${string}`,
    },
    types: { Permit: e.types.Permit },
    primaryType: "Permit" as const,
    message: {
      owner: e.message.owner as `0x${string}`,
      spender: e.message.spender as `0x${string}`,
      value: BigInt(e.message.value),
      nonce: BigInt(e.message.nonce),
      deadline: BigInt(e.message.deadline),
    },
  };
}
