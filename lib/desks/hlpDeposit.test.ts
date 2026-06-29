import { describe, expect, it } from "vitest";
import {
  HLP_VAULT,
  HL_BRIDGE,
  HL_MIN_USDC,
  USDC_ARBITRUM,
  hlpUsdcHumanToRaw,
  hlpUsdcRawToHuman,
  validateHlpDepositAmount,
} from "./hlpDeposit";

describe("hlpUsdcHumanToRaw", () => {
  it("converts whole number", () => {
    expect(hlpUsdcHumanToRaw("100")).toBe(100_000_000n);
  });
  it("converts decimal", () => {
    expect(hlpUsdcHumanToRaw("100.50")).toBe(100_500_000n);
  });
  it("truncates beyond 6 decimals", () => {
    expect(hlpUsdcHumanToRaw("1.1234567")).toBe(1_123_456n);
  });
  it("handles padding", () => {
    expect(hlpUsdcHumanToRaw("1.5")).toBe(1_500_000n);
  });
  it("throws on invalid input", () => {
    expect(() => hlpUsdcHumanToRaw("")).toThrow();
    expect(() => hlpUsdcHumanToRaw("abc")).toThrow();
    expect(() => hlpUsdcHumanToRaw("1.2.3")).toThrow();
  });
});

describe("hlpUsdcRawToHuman", () => {
  it("converts round number", () => {
    expect(hlpUsdcRawToHuman(100_000_000n)).toBe("100");
  });
  it("converts with decimals", () => {
    expect(hlpUsdcRawToHuman(100_500_000n)).toBe("100.5");
  });
  it("handles zero", () => {
    expect(hlpUsdcRawToHuman(0n)).toBe("0");
  });
  it("trims trailing zeros", () => {
    expect(hlpUsdcRawToHuman(1_000_001n)).toBe("1.000001");
  });
});

describe("hlpUsdcHumanToRaw round-trips", () => {
  it("round-trips 50 USDC", () => {
    expect(hlpUsdcRawToHuman(hlpUsdcHumanToRaw("50"))).toBe("50");
  });
  it("round-trips minimum 5 USDC", () => {
    expect(hlpUsdcHumanToRaw("5")).toBe(5_000_000n);
    expect(hlpUsdcRawToHuman(5_000_000n)).toBe("5");
  });
});

describe("validateHlpDepositAmount", () => {
  it("rejects zero", () => {
    expect(validateHlpDepositAmount(0)).not.toBeNull();
  });
  it("rejects negative", () => {
    expect(validateHlpDepositAmount(-10)).not.toBeNull();
  });
  it("rejects below minimum", () => {
    expect(validateHlpDepositAmount(HL_MIN_USDC - 0.01)).not.toBeNull();
  });
  it("accepts exact minimum", () => {
    expect(validateHlpDepositAmount(HL_MIN_USDC)).toBeNull();
  });
  it("accepts large amounts", () => {
    expect(validateHlpDepositAmount(100_000)).toBeNull();
  });
  it("rejects NaN", () => {
    expect(validateHlpDepositAmount(Number.NaN)).not.toBeNull();
  });
});

describe("constants are correctly specified", () => {
  it("HL_BRIDGE matches the Arbiscan-verified Bridge2 — a wrong address burns deposits", () => {
    expect(HL_BRIDGE.toLowerCase()).toBe("0x2df1c51e09aecf9cacb7bc98cb1742757f163df7");
  });

  it("HL_BRIDGE is a 42-char hex address", () => {
    expect(HL_BRIDGE).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });
  it("HLP_VAULT is the expected address", () => {
    expect(HLP_VAULT.toLowerCase()).toBe("0xdfc24b077bc1425ad1dea75bcb6f8158e10df303");
  });
  it("USDC_ARBITRUM is Arbitrum native USDC", () => {
    expect(USDC_ARBITRUM.toLowerCase()).toBe("0xaf88d065e77c8cc2239327c5edb3a432268e5831");
  });
  it("HL_MIN_USDC is 5", () => {
    expect(HL_MIN_USDC).toBe(5);
  });
});

describe("vaultTransfer usd scaling", () => {
  it("10 USDC → 10_000_000 usd units", () => {
    const usdc = 10;
    const usdUnits = Math.round(usdc * 1_000_000);
    expect(usdUnits).toBe(10_000_000);
  });
  it("5.5 USDC → 5_500_000 usd units", () => {
    const usdc = 5.5;
    const usdUnits = Math.round(usdc * 1_000_000);
    expect(usdUnits).toBe(5_500_000);
  });
});
