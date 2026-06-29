import { describe, expect, it } from "vitest";
import { cowApprovalAmount, kyberApprovalAmount } from "./approve";

// These pure helpers guarantee the swap path never approves maxUint256.

describe("kyberApprovalAmount", () => {
  it("returns the exact amountInRaw as bigint", () => {
    expect(kyberApprovalAmount("1000000")).toBe(1_000_000n);
  });

  it("handles large USDC amounts (18 decimals equivalent)", () => {
    const raw = "1000000000000000000"; // 1e18
    expect(kyberApprovalAmount(raw)).toBe(1_000_000_000_000_000_000n);
  });

  it("is strictly equal to amountIn — not maxUint256", () => {
    const maxUint256 = 2n ** 256n - 1n;
    const result = kyberApprovalAmount("500000000"); // 500 USDC (6dp)
    expect(result).toBe(500_000_000n);
    expect(result).not.toBe(maxUint256);
  });

  it("handles minimum unit (1 raw)", () => {
    expect(kyberApprovalAmount("1")).toBe(1n);
  });
});

describe("cowApprovalAmount", () => {
  it("returns sellAmount + feeAmount", () => {
    expect(cowApprovalAmount("900000000", "100000000")).toBe(1_000_000_000n);
  });

  it("handles zero fee", () => {
    expect(cowApprovalAmount("500000000", "0")).toBe(500_000_000n);
  });

  it("handles large amounts without overflow", () => {
    expect(cowApprovalAmount("100000000000000000000", "1000000000000000000")).toBe(
      101_000_000_000_000_000_000n,
    );
  });

  it("is strictly equal to sell+fee — not maxUint256", () => {
    const maxUint256 = 2n ** 256n - 1n;
    const result = cowApprovalAmount("800000000", "200000000");
    expect(result).toBe(1_000_000_000n);
    expect(result).not.toBe(maxUint256);
  });

  it("is additive (sellAmount alone < result)", () => {
    const sell = "800000000";
    const fee = "50000000";
    const result = cowApprovalAmount(sell, fee);
    expect(result).toBeGreaterThan(BigInt(sell));
    expect(result).toBe(850_000_000n);
  });
});
