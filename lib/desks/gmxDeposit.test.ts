import { describe, expect, it } from "vitest";
import {
  GMX_EXECUTION_FEE,
  formatEther,
  formatGm,
  gmxUsdcHumanToRaw,
  gmxUsdcRawToHuman,
  validateGmxDepositAmount,
} from "./gmxDeposit";

describe("gmxUsdcHumanToRaw", () => {
  it("converts whole number", () => {
    expect(gmxUsdcHumanToRaw("100")).toBe(100_000_000n);
  });
  it("converts decimal", () => {
    expect(gmxUsdcHumanToRaw("100.50")).toBe(100_500_000n);
  });
  it("truncates beyond 6 decimals", () => {
    expect(gmxUsdcHumanToRaw("1.1234567")).toBe(1_123_456n);
  });
  it("handles fractional padding", () => {
    expect(gmxUsdcHumanToRaw("1.5")).toBe(1_500_000n);
  });
  it("handles minimum 5 USDC", () => {
    expect(gmxUsdcHumanToRaw("5")).toBe(5_000_000n);
  });
  it("throws on empty/invalid input", () => {
    expect(() => gmxUsdcHumanToRaw("")).toThrow();
    expect(() => gmxUsdcHumanToRaw("abc")).toThrow();
    expect(() => gmxUsdcHumanToRaw("1.2.3")).toThrow();
  });
});

describe("gmxUsdcRawToHuman", () => {
  it("converts round number", () => {
    expect(gmxUsdcRawToHuman(100_000_000n)).toBe("100");
  });
  it("converts with decimals", () => {
    expect(gmxUsdcRawToHuman(100_500_000n)).toBe("100.5");
  });
  it("handles zero", () => {
    expect(gmxUsdcRawToHuman(0n)).toBe("0");
  });
  it("trims trailing zeros", () => {
    expect(gmxUsdcRawToHuman(1_000_001n)).toBe("1.000001");
    expect(gmxUsdcRawToHuman(1_000_010n)).toBe("1.00001");
  });
});

describe("gmxUsdcHumanToRaw round-trips", () => {
  it("round-trips 100.50", () => {
    expect(gmxUsdcRawToHuman(gmxUsdcHumanToRaw("100.50"))).toBe("100.5");
  });
  it("round-trips 5 USDC", () => {
    expect(gmxUsdcHumanToRaw("5")).toBe(5_000_000n);
    expect(gmxUsdcRawToHuman(5_000_000n)).toBe("5");
  });
});

describe("validateGmxDepositAmount", () => {
  it("rejects zero", () => {
    expect(validateGmxDepositAmount(0)).not.toBeNull();
  });
  it("rejects negative", () => {
    expect(validateGmxDepositAmount(-1)).not.toBeNull();
  });
  it("rejects below 5 USDC", () => {
    expect(validateGmxDepositAmount(4.99)).not.toBeNull();
  });
  it("accepts 5 USDC", () => {
    expect(validateGmxDepositAmount(5)).toBeNull();
  });
  it("accepts 1000 USDC", () => {
    expect(validateGmxDepositAmount(1000)).toBeNull();
  });
  it("rejects NaN", () => {
    expect(validateGmxDepositAmount(Number.NaN)).not.toBeNull();
  });
});

describe("formatGm", () => {
  it("formats whole GM tokens", () => {
    expect(formatGm(1_000_000_000_000_000_000n)).toBe("1");
  });
  it("formats fractional GM tokens", () => {
    expect(formatGm(1_500_000_000_000_000_000n)).toBe("1.5");
    expect(formatGm(1_234_000_000_000_000_000n)).toBe("1.234");
  });
  it("handles zero", () => {
    expect(formatGm(0n)).toBe("0");
  });
});

describe("formatEther", () => {
  it("formats execution fee correctly", () => {
    // 3e14 wei = 0.0003 ETH
    const result = formatEther(GMX_EXECUTION_FEE);
    expect(result).toBe("0.0003");
  });
  it("formats whole ETH", () => {
    expect(formatEther(1_000_000_000_000_000_000n)).toBe("1");
  });
});

describe("GMX_EXECUTION_FEE constant", () => {
  it("is 0.0003 ETH in wei", () => {
    expect(GMX_EXECUTION_FEE).toBe(300_000_000_000_000n);
  });
  it("is less than 0.001 ETH (reasonable upper bound)", () => {
    expect(GMX_EXECUTION_FEE).toBeLessThan(1_000_000_000_000_000n);
  });
});
