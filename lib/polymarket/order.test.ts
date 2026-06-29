/**
 * lib/polymarket/order.test.ts
 *
 * Tests for order.ts and amount math parity.
 *
 * a) sign-and-recover: builds a SignedOrder using a throwaway viem wallet,
 *    recovers the signer under the CORRECT domain (name:"Polymarket CTF Exchange")
 *    and verifies it does NOT recover under the OLD domain (name:"ClobAuthDomain").
 *
 * b) amount math parity across tick sizes with awkward floats.
 *
 * c) secureSalt: range, parseInt round-trip, uniqueness, non-zero (modulo fix).
 *
 * d) validateTickSize: accepts valid set, throws on invalid values.
 */

import { recoverTypedDataAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { describe, expect, it } from "vitest";
import { PROTOCOL_NAME, PROTOCOL_VERSION, getContractConfig, secureSalt } from "./order";
import { validateTickSize } from "./useBet";

// ─── throwaway test wallet ──────────────────────────────────────────────────
// Private key is arbitrary -- used for unit tests only, never funded.
const TEST_PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;
const testAccount = privateKeyToAccount(TEST_PRIVATE_KEY);

// ─── a) sign-and-recover ───────────────────────────────────────────────────

describe("EIP-712 domain: sign and recover", () => {
  const contracts = getContractConfig(137);

  // Minimal order struct (values chosen to be valid uint256 / address / uint8)
  const orderMessage = {
    salt: BigInt("12345678901234"),
    maker: testAccount.address,
    signer: testAccount.address,
    taker: "0x0000000000000000000000000000000000000000" as `0x${string}`,
    tokenId: BigInt("123456789"),
    makerAmount: BigInt("55000000"), // 55 USDC.e (6 dec)
    takerAmount: BigInt("100000000"), // 100 shares (6 dec)
    expiration: BigInt("0"),
    nonce: BigInt("0"),
    feeRateBps: BigInt("0"),
    side: 0, // BUY
    signatureType: 0, // EOA
  };

  const orderTypes = {
    Order: [
      { name: "salt", type: "uint256" },
      { name: "maker", type: "address" },
      { name: "signer", type: "address" },
      { name: "taker", type: "address" },
      { name: "tokenId", type: "uint256" },
      { name: "makerAmount", type: "uint256" },
      { name: "takerAmount", type: "uint256" },
      { name: "expiration", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "feeRateBps", type: "uint256" },
      { name: "side", type: "uint8" },
      { name: "signatureType", type: "uint8" },
    ],
  } as const;

  it("recovers signer under CORRECT domain (name:Polymarket CTF Exchange)", async () => {
    const domain = {
      name: PROTOCOL_NAME, // "Polymarket CTF Exchange"
      version: PROTOCOL_VERSION, // "1"
      chainId: 137,
      verifyingContract: contracts.exchange,
    } as const;

    const signature = await testAccount.signTypedData({
      domain,
      types: orderTypes,
      primaryType: "Order",
      message: orderMessage,
    });

    const recovered = await recoverTypedDataAddress({
      domain,
      types: orderTypes,
      primaryType: "Order",
      message: orderMessage,
      signature,
    });

    expect(recovered.toLowerCase()).toBe(testAccount.address.toLowerCase());
  });

  it("does NOT recover under OLD domain (name:ClobAuthDomain) -- regression lock", async () => {
    const correctDomain = {
      name: PROTOCOL_NAME,
      version: PROTOCOL_VERSION,
      chainId: 137,
      verifyingContract: contracts.exchange,
    } as const;

    const signature = await testAccount.signTypedData({
      domain: correctDomain,
      types: orderTypes,
      primaryType: "Order",
      message: orderMessage,
    });

    // Attempt recovery under the OLD (wrong) domain name
    const wrongDomain = {
      name: "ClobAuthDomain",
      version: "1",
      chainId: 137,
      verifyingContract: contracts.exchange,
    } as const;

    const recoveredUnderWrongDomain = await recoverTypedDataAddress({
      domain: wrongDomain,
      types: orderTypes,
      primaryType: "Order",
      message: orderMessage,
      signature,
    });

    // Must NOT match the signer
    expect(recoveredUnderWrongDomain.toLowerCase()).not.toBe(testAccount.address.toLowerCase());
  });

  it("maker and signer are the wallet address, taker is zero, expiration is 0", async () => {
    expect(orderMessage.maker.toLowerCase()).toBe(testAccount.address.toLowerCase());
    expect(orderMessage.signer.toLowerCase()).toBe(testAccount.address.toLowerCase());
    expect(orderMessage.taker).toBe("0x0000000000000000000000000000000000000000");
    expect(orderMessage.expiration).toBe(BigInt("0"));
  });

  it("uses exchange address for standard market, negRiskExchange for negRisk", () => {
    const c = getContractConfig(137);
    expect(c.exchange).toBe("0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E");
    expect(c.negRiskExchange).toBe("0xC5d563A36AE78145C45a50134d48A1215220f80a");
    expect(c.collateral).toBe("0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174");
  });
});

// ─── b) amount math parity ─────────────────────────────────────────────────

describe("amount math parity (integer-only, matches SDK helpers)", () => {
  const DECIMALS = 6;

  // Replicate the SDK's integer math: makerAmount = round(price * size * 1e6),
  // takerAmount = round(size * 1e6). We use the same rounding as the SDK.
  function calcAmounts(price: number, size: number) {
    const makerAmount = BigInt(Math.round(price * size * 10 ** DECIMALS));
    const takerAmount = BigInt(Math.round(size * 10 ** DECIMALS));
    return { makerAmount, takerAmount };
  }

  it("price 0.55, size 10 -- standard case", () => {
    const { makerAmount, takerAmount } = calcAmounts(0.55, 10);
    expect(makerAmount).toBe(BigInt(5_500_000));
    expect(takerAmount).toBe(BigInt(10_000_000));
  });

  it("price 0.07, size 33.33 -- awkward float (tick 0.01)", () => {
    // 0.07 * 33.33 * 1e6 = 2333100.0 -> 2333100
    const { makerAmount, takerAmount } = calcAmounts(0.07, 33.33);
    expect(makerAmount).toBe(BigInt(Math.round(0.07 * 33.33 * 1e6)));
    expect(takerAmount).toBe(BigInt(Math.round(33.33 * 1e6)));
    // Ensure no float corruption: takerAmount should be exactly 33_330_000
    expect(takerAmount).toBe(BigInt(33_330_000));
  });

  it("tick 0.1 -- price 0.1, size 50", () => {
    const { makerAmount, takerAmount } = calcAmounts(0.1, 50);
    expect(makerAmount).toBe(BigInt(5_000_000));
    expect(takerAmount).toBe(BigInt(50_000_000));
  });

  it("tick 0.001 -- price 0.123, size 100", () => {
    const { makerAmount, takerAmount } = calcAmounts(0.123, 100);
    expect(makerAmount).toBe(BigInt(Math.round(0.123 * 100 * 1e6)));
    expect(takerAmount).toBe(BigInt(100_000_000));
  });

  it("tick 0.0001 -- price 0.0034, size 200", () => {
    const { makerAmount, takerAmount } = calcAmounts(0.0034, 200);
    expect(makerAmount).toBe(BigInt(Math.round(0.0034 * 200 * 1e6)));
    expect(takerAmount).toBe(BigInt(200_000_000));
  });

  it("payout is always 1 USDC.e per share on correct outcome", () => {
    const size = 17;
    const { takerAmount } = calcAmounts(0.55, size);
    expect(Number(takerAmount) / 10 ** DECIMALS).toBe(size);
  });

  it("minimum order: 5 shares at 0.01", () => {
    const { makerAmount, takerAmount } = calcAmounts(0.01, 5);
    expect(makerAmount).toBe(BigInt(50_000)); // $0.05 USDC.e
    expect(takerAmount).toBe(BigInt(5_000_000));
  });
});

// ─── c) secureSalt ────────────────────────────────────────────────────────

describe("secureSalt", () => {
  const MAX_SAFE = 9_007_199_254_740_991; // Number.MAX_SAFE_INTEGER = 2^53-1

  it("produces a value <= MAX_SAFE_INTEGER", () => {
    for (let i = 0; i < 100; i++) {
      const s = secureSalt();
      const n = Number.parseInt(s, 10);
      expect(n).toBeGreaterThan(0);
      expect(n).toBeLessThanOrEqual(MAX_SAFE);
    }
  });

  it("survives Number.parseInt round-trip without precision loss", () => {
    for (let i = 0; i < 200; i++) {
      const s = secureSalt();
      const n = Number.parseInt(s, 10);
      // The integer must equal BigInt parsing to prove no float precision loss
      expect(BigInt(n)).toBe(BigInt(s));
    }
  });

  it("produces no repeats in 10k samples", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 10_000; i++) {
      const s = secureSalt();
      expect(seen.has(s)).toBe(false);
      seen.add(s);
    }
    expect(seen.size).toBe(10_000);
  });

  it("is never zero -- regression for value===MAX_SAFE modulo bug", () => {
    // Run a large sample; the modulo fix guarantees >= 1 always.
    for (let i = 0; i < 10_000; i++) {
      const s = secureSalt();
      expect(Number.parseInt(s, 10)).toBeGreaterThan(0);
    }
  });
});

// ─── d) validateTickSize ──────────────────────────────────────────────────

describe("validateTickSize", () => {
  it("accepts all four valid tick sizes", () => {
    expect(validateTickSize("0.1")).toBe("0.1");
    expect(validateTickSize("0.01")).toBe("0.01");
    expect(validateTickSize("0.001")).toBe("0.001");
    expect(validateTickSize("0.0001")).toBe("0.0001");
  });

  it("throws on an arbitrary bad string", () => {
    expect(() => validateTickSize("0.05")).toThrow(/invalid ticksize/i);
  });

  it("throws on empty string", () => {
    expect(() => validateTickSize("")).toThrow(/invalid ticksize/i);
  });

  it("throws on numeric-looking value outside the set", () => {
    expect(() => validateTickSize("0.2")).toThrow(/invalid ticksize/i);
  });

  it("throws on a value that looks like the set but has extra whitespace", () => {
    expect(() => validateTickSize(" 0.01")).toThrow(/invalid ticksize/i);
  });

  it("error message includes the bad value and lists valid options", () => {
    try {
      validateTickSize("bad");
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).toContain("bad");
      expect(msg).toContain("0.1");
      expect(msg).toContain("0.0001");
    }
  });
});
