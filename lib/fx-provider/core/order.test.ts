import { describe, expect, it } from "vitest";
import { ORDER_TYPES, type OrderStruct, buildOrderTypedData } from "./order";
import { groupIdFor, makeOrderId, makeVlSibling } from "./uuidInt";

// Contract-critical: this MUST match your FX provider order-signer
// exactly or the struct hash and every signature is wrong.
describe("ORDER_TYPES (FX Provider Order EIP-712)", () => {
  it("matches the market-maker spec exactly", () => {
    expect(ORDER_TYPES.Order).toEqual([
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
    ]);
  });
});

const order: OrderStruct = {
  user: "0x000000000000000000000000000000000000dEaD",
  expiration: 1780000000,
  feeBps: 0,
  recipient: "0x0000000000000000000000000000000000000000",
  fromToken: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
  toToken: "0xdac17f958d2ee523a2206206994597c13d831ec7",
  fromAmount: 10_000_000n,
  toAmount: 9_995_000n,
  initialDepositAmount: 0n,
  uuid: 12345n,
};

describe("buildOrderTypedData", () => {
  const td = buildOrderTypedData(order, {
    chain_id: 1,
    settlement_address: "0xB5C50C5D5f038404F85970b7f5B7259C4AC0E198",
  });
  it("uses the FX Provider domain", () => {
    expect(td.domain).toEqual({
      name: process.env.NEXT_PUBLIC_EIP712_DOMAIN_NAME ?? "FX Provider", // Replace with your provider EIP-712 domain name
      version: "1",
      chainId: 1,
      verifyingContract: "0xB5C50C5D5f038404F85970b7f5B7259C4AC0E198",
    });
    expect(td.primaryType).toBe("Order");
  });
  it("coerces all uint fields to bigint", () => {
    expect(td.message.expiration).toBe(1780000000n);
    expect(td.message.feeBps).toBe(0n);
    expect(td.message.fromAmount).toBe(10_000_000n);
    expect(td.message.uuid).toBe(12345n);
  });
});

describe("uuid_int composite layout", () => {
  it("standalone: leg_id=0, group_id = uuid_bits >> 16, executor_id=0", () => {
    const p = makeOrderId(0n);
    const i = BigInt(p.uuid_int);
    const legId = i & 0xfffn;
    const groupId = (i >> 12n) & ((1n << 112n) - 1n);
    const uuidBits = (i >> 124n) & ((1n << 128n) - 1n);
    const executor = (i >> 252n) & 0xfn;
    expect(legId).toBe(0n);
    expect(executor).toBe(0n);
    expect(uuidBits).toBe(BigInt(`0x${p.order_id.replace(/-/g, "")}`));
    expect(groupId).toBe(uuidBits >> 16n);
  });

  it("VL sibling: leg_id increments; group_id shared with primary", () => {
    const primary = makeOrderId();
    const gid = groupIdFor(primary.order_id);
    for (const leg of [1, 2, 5, 19]) {
      const s = makeVlSibling(gid, leg);
      const i = BigInt(s.uuid_int);
      const legId = i & 0xfffn;
      const groupId = (i >> 12n) & ((1n << 112n) - 1n);
      expect(legId).toBe(BigInt(leg));
      expect(groupId).toBe(gid);
    }
  });

  it("rejects out-of-range leg_id", () => {
    expect(() => makeVlSibling(0n, 4096)).toThrow();
    expect(() => makeVlSibling(0n, -1)).toThrow();
  });
});
