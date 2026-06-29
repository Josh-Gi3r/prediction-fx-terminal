import { describe, expect, it } from "vitest";
import { INTENT_TYPES, buildIntentTypedData, buildPermitTypedData } from "./intent";
import type { PermitEnvelope, FxIntent } from "./types";

// Contract-critical: this MUST match your FX provider signer INTENT_TYPES
// exactly (field names, order, types) or the struct hash — and every signature — is wrong.
describe("INTENT_TYPES", () => {
  it("matches the FX Provider signer struct exactly", () => {
    expect(INTENT_TYPES.Intent).toEqual([
      { name: "taker", type: "address" },
      { name: "inputToken", type: "address" },
      { name: "outputToken", type: "address" },
      { name: "maxInputAmount", type: "uint256" },
      { name: "minOutputAmount", type: "uint256" },
      { name: "recipient", type: "address" },
      { name: "initialDepositAmount", type: "uint256" },
      { name: "uuid", type: "uint256" },
      { name: "deadline", type: "uint48" },
    ]);
  });
});

const routeParams: FxIntent = {
  taker: "0x000000000000000000000000000000000000dEaD",
  inputToken: "0x965d4B4546716e416E950Bc30467D128455D2d0E",
  outputToken: "0x058e06ca2628165a6cd1e80e4dc82203dc0020aa",
  maxInputAmount: "100000000",
  minOutputAmount: "122595622",
  recipient: "0x000000000000000000000000000000000000dEaD",
  initialDepositAmount: "100000000",
  uuid: "123456789012345678901234567890",
  deadline: 1780000000,
};

describe("buildIntentTypedData", () => {
  const td = buildIntentTypedData(routeParams, {
    chain_id: 11155111,
    settlement_address: "0x83475A1bD98a8DC2DCd507A747e4DC85da241D6e",
  });

  it("sets the FX Provider domain from config", () => {
    expect(td.domain).toEqual({
      name: process.env.NEXT_PUBLIC_EIP712_DOMAIN_NAME ?? "FX Provider", // Replace with your provider EIP-712 domain name
      version: "1",
      chainId: 11155111,
      verifyingContract: "0x83475A1bD98a8DC2DCd507A747e4DC85da241D6e",
    });
    expect(td.primaryType).toBe("Intent");
  });

  it("coerces uint fields to bigint, keeps addresses as strings", () => {
    expect(td.message.maxInputAmount).toBe(100000000n);
    expect(td.message.minOutputAmount).toBe(122595622n);
    expect(td.message.uuid).toBe(123456789012345678901234567890n);
    expect(td.message.deadline).toBe(1780000000n);
    expect(td.message.taker).toBe(routeParams.taker);
    expect(typeof td.message.inputToken).toBe("string");
  });
});

describe("buildPermitTypedData", () => {
  const permit: PermitEnvelope = {
    permit_supported: true,
    permit_required: true,
    token: "0x965d4B4546716e416E950Bc30467D128455D2d0E",
    spender: "0x83c1368110B640A729f3810De5FBe94b99aa5668",
    owner: "0x000000000000000000000000000000000000dEaD",
    value_raw: "100000000",
    current_allowance_raw: "0",
    nonce: 3,
    suggested_deadline: 1780000600,
    domain: {
      name: "USD Coin",
      version: "2",
      chainId: 11155111,
      verifyingContract: "0x965d4B4546716e416E950Bc30467D128455D2d0E",
    },
    eip712: {
      domain: {
        name: "USD Coin",
        version: "2",
        chainId: 11155111,
        verifyingContract: "0x965d4B4546716e416E950Bc30467D128455D2d0E",
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
        owner: "0x000000000000000000000000000000000000dEaD",
        spender: "0x83c1368110B640A729f3810De5FBe94b99aa5668",
        value: "100000000",
        nonce: 3,
        deadline: 1780000600,
      },
    },
  };

  it("coerces permit message uints to bigint and preserves the permit domain/types", () => {
    const td = buildPermitTypedData(permit);
    expect(td.primaryType).toBe("Permit");
    expect(td.domain.name).toBe("USD Coin");
    expect(td.message.value).toBe(100000000n);
    expect(td.message.nonce).toBe(3n);
    expect(td.message.deadline).toBe(1780000600n);
  });
});
