import { describe, expect, it } from "vitest";
import { assembleVlBatch, exactToAmountRaw } from "./vl";

describe("exactToAmountRaw", () => {
  // Value verified LIVE against FX provider /verify-signature (2026-05-31): a fresh-key
  // Order signed with this toAmount recovered valid:true. Locks the formula so a
  // float-multiply regression can't silently break VL signing again.
  it("matches The FX provider's Decimal reconstruction for a realistic fractional price", () => {
    // amount 123.45 USDC, price 36123.456789 ITRY/USDC, ITRY 18 decimals.
    expect(exactToAmountRaw("123.45", "36123.456789", 18)).toBe(4459440740602050000000000n);
  });

  it("is exact for clean integers", () => {
    expect(exactToAmountRaw("100", "2", 18)).toBe(200n * 10n ** 18n);
    expect(exactToAmountRaw("1", "1", 6)).toBe(1_000_000n);
  });

  it("floors (ROUND_DOWN) sub-unit remainders, never floats", () => {
    // 1 * 0.9999999 at 6 dp = 999999.9 quote-units → floor 999999
    expect(exactToAmountRaw("1", "0.9999999", 6)).toBe(999999n);
  });
});

describe("assembleVlBatch", () => {
  it("shares one group_id across siblings with sequential leg_ids", () => {
    const legs = assembleVlBatch({
      owner: "0x1111111111111111111111111111111111111111",
      fromToken: "0x2222222222222222222222222222222222222222",
      fromDecimals: 6,
      expiration: 2_000_000_000,
      legs: [
        {
          toToken: "0x3333333333333333333333333333333333333333",
          toDecimals: 18,
          side: "sell",
          amount: 100,
          price: 2,
        },
        {
          toToken: "0x4444444444444444444444444444444444444444",
          toDecimals: 6,
          side: "sell",
          amount: 100,
          price: 1,
        },
      ],
    });
    expect(legs).toHaveLength(2);
    // all siblings share owner + fromToken
    expect(legs.every((l) => l.order.user === "0x1111111111111111111111111111111111111111")).toBe(
      true,
    );
    expect(
      legs.every((l) => l.order.fromToken === "0x2222222222222222222222222222222222222222"),
    ).toBe(true);
    // exact toAmount via integer math, not float
    expect(legs[0]?.order.toAmount).toBe(200n * 10n ** 18n);
  });
});
