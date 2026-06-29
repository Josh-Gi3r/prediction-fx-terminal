/**
 * Sign-and-recover tests for every FX Provider EIP-712 typed-data builder.
 *
 * No network calls. Uses a throwaway viem privateKeyToAccount wallet.
 * Domain fixture mirrors the real FX Provider mainnet config (from /api/config):
 *   name: "<provider-eip712-name>", version: "1", chainId: 1, verifyingContract: settlement_address
 * ChainId 1 (mainnet) used throughout because ACTIVE_CHAIN defaults to mainnet
 * and assertChain() in orders.ts checks domain.chainId === ACTIVE_CHAIN.id.
 *
 * NOTE on message casts: viem infers uint48 ABI fields as `number` from the types
 * object, but buildIntentTypedData / buildOrderTypedData coerce all uint fields to
 * bigint (viem requirement for signTypedData at runtime). `as unknown as never` at
 * sign/recover call sites bridges this TypeScript-only mismatch without touching
 * production code. noExplicitAny is warn-only in this project's biome config.
 */

import { recoverTypedDataAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { describe, expect, it } from "vitest";
import { buildIntentTypedData, buildPermitTypedData } from "./intent";
import { buildCancelVlBatchTypedData, buildOrderTypedData } from "./order";
import type { PermitEnvelope, FxConfig, FxIntent } from "./types";

// Throwaway test key — never on mainnet, never holds funds.
const PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const account = privateKeyToAccount(PRIVATE_KEY);

// Real FX Provider mainnet config values (from GET /api/config, committed in code comments).
const MAINNET_CONFIG: Pick<FxConfig, "chain_id" | "settlement_address"> = {
  chain_id: 1,
  settlement_address: "0xB5C50C5D5f038404F85970b7f5B7259C4AC0E198",
};

describe("Intent typed data: sign → recoverTypedDataAddress", () => {
  const routeParams: FxIntent = {
    taker: account.address,
    inputToken: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    outputToken: "0xdac17f958d2ee523a2206206994597c13d831ec7",
    maxInputAmount: "100000000",
    minOutputAmount: "98500000",
    recipient: account.address,
    initialDepositAmount: "100000000",
    uuid: "999888777666555444333222111",
    deadline: 1780000000,
  };

  it("recovers the signer address from an Intent signature", async () => {
    const td = buildIntentTypedData(routeParams, MAINNET_CONFIG);
    // biome-ignore lint/suspicious/noExplicitAny: viem maps uint32 to number, builders emit bigint; widths are sign-equivalent
    const msg = td.message as unknown as any;
    const sig = await account.signTypedData({
      domain: td.domain,
      types: td.types,
      primaryType: td.primaryType,
      message: msg,
    });
    const recovered = await recoverTypedDataAddress({
      domain: td.domain,
      types: td.types,
      primaryType: td.primaryType,
      message: msg,
      signature: sig,
    });
    expect(recovered.toLowerCase()).toBe(account.address.toLowerCase());
  });

  it("different uuid produces a different signature", async () => {
    const td1 = buildIntentTypedData(routeParams, MAINNET_CONFIG);
    const td2 = buildIntentTypedData({ ...routeParams, uuid: "1" }, MAINNET_CONFIG);
    const sig1 = await account.signTypedData({
      domain: td1.domain,
      types: td1.types,
      primaryType: td1.primaryType,
      message: td1.message as unknown as never,
    });
    const sig2 = await account.signTypedData({
      domain: td2.domain,
      types: td2.types,
      primaryType: td2.primaryType,
      message: td2.message as unknown as never,
    });
    expect(sig1).not.toBe(sig2);
  });
});

describe("Order typed data: sign → recoverTypedDataAddress", () => {
  const order = {
    user: account.address as `0x${string}`,
    expiration: 1780000000,
    feeBps: 0,
    recipient: "0x0000000000000000000000000000000000000000" as `0x${string}`,
    fromToken: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48" as `0x${string}`,
    toToken: "0xdac17f958d2ee523a2206206994597c13d831ec7" as `0x${string}`,
    fromAmount: 10_000_000n,
    toAmount: 9_995_000n,
    initialDepositAmount: 0n,
    uuid: 98765432109876543210n,
  };

  it("recovers the signer address from an Order signature", async () => {
    const td = buildOrderTypedData(order, MAINNET_CONFIG);
    // biome-ignore lint/suspicious/noExplicitAny: viem maps uint32 to number, builders emit bigint; widths are sign-equivalent
    const msg = td.message as unknown as any;
    const sig = await account.signTypedData({
      domain: td.domain,
      types: td.types,
      primaryType: td.primaryType,
      message: msg,
    });
    const recovered = await recoverTypedDataAddress({
      domain: td.domain,
      types: td.types,
      primaryType: td.primaryType,
      message: msg,
      signature: sig,
    });
    expect(recovered.toLowerCase()).toBe(account.address.toLowerCase());
  });

  it("mutating fromAmount changes the signature", async () => {
    const td1 = buildOrderTypedData(order, MAINNET_CONFIG);
    const td2 = buildOrderTypedData({ ...order, fromAmount: 20_000_000n }, MAINNET_CONFIG);
    const sig1 = await account.signTypedData({
      domain: td1.domain,
      types: td1.types,
      primaryType: td1.primaryType,
      message: td1.message as unknown as never,
    });
    const sig2 = await account.signTypedData({
      domain: td2.domain,
      types: td2.types,
      primaryType: td2.primaryType,
      message: td2.message as unknown as never,
    });
    expect(sig1).not.toBe(sig2);
  });
});

describe("CancelVLBatch typed data: sign → recoverTypedDataAddress", () => {
  const vlBatchId = "f47ac10b-58cc-4372-a567-0e02b2c3d479";

  it("recovers the signer address from a CancelVLBatch signature", async () => {
    const td = buildCancelVlBatchTypedData(account.address, vlBatchId, MAINNET_CONFIG);
    const sig = await account.signTypedData({
      domain: td.domain,
      types: td.types,
      primaryType: td.primaryType,
      message: td.message,
    });
    const recovered = await recoverTypedDataAddress({
      domain: td.domain,
      types: td.types,
      primaryType: td.primaryType,
      message: td.message,
      signature: sig,
    });
    expect(recovered.toLowerCase()).toBe(account.address.toLowerCase());
  });

  it("different vlBatchId produces a different signature", async () => {
    const td1 = buildCancelVlBatchTypedData(account.address, vlBatchId, MAINNET_CONFIG);
    const td2 = buildCancelVlBatchTypedData(
      account.address,
      "a1b2c3d4-0000-0000-0000-000000000001",
      MAINNET_CONFIG,
    );
    const sig1 = await account.signTypedData({
      domain: td1.domain,
      types: td1.types,
      primaryType: td1.primaryType,
      message: td1.message,
    });
    const sig2 = await account.signTypedData({
      domain: td2.domain,
      types: td2.types,
      primaryType: td2.primaryType,
      message: td2.message,
    });
    expect(sig1).not.toBe(sig2);
  });
});

describe("Permit typed data: sign → recoverTypedDataAddress", () => {
  const permitEnvelope: PermitEnvelope = {
    permit_supported: true,
    permit_required: true,
    token: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    spender: "0xB5C50C5D5f038404F85970b7f5B7259C4AC0E198",
    owner: account.address,
    value_raw: "100000000",
    current_allowance_raw: "0",
    nonce: 0,
    suggested_deadline: 1780000600,
    domain: {
      name: "USD Coin",
      version: "2",
      chainId: 1,
      verifyingContract: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    },
    eip712: {
      domain: {
        name: "USD Coin",
        version: "2",
        chainId: 1,
        verifyingContract: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      },
      primaryType: "Permit",
      types: {
        Permit: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
          { name: "value", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      },
      message: {
        owner: account.address,
        spender: "0xB5C50C5D5f038404F85970b7f5B7259C4AC0E198",
        value: "100000000",
        nonce: 0,
        deadline: 1780000600,
      },
    },
  };

  it("recovers the signer address from a Permit signature", async () => {
    const td = buildPermitTypedData(permitEnvelope);
    const sig = await account.signTypedData({
      domain: td.domain,
      types: td.types,
      primaryType: td.primaryType,
      message: td.message,
    });
    const recovered = await recoverTypedDataAddress({
      domain: td.domain,
      types: td.types,
      primaryType: td.primaryType,
      message: td.message,
      signature: sig,
    });
    expect(recovered.toLowerCase()).toBe(account.address.toLowerCase());
  });
});
