import { describe, expect, it } from "vitest";
import { derivePtApy, usdcHumanToRaw, usdcRawToHuman } from "./pendleTrade";

describe("usdcHumanToRaw", () => {
  it("converts whole number", () => {
    expect(usdcHumanToRaw("100")).toBe("100000000");
  });
  it("converts decimal", () => {
    expect(usdcHumanToRaw("100.50")).toBe("100500000");
  });
  it("truncates beyond 6 decimals", () => {
    // 1.1234567 → only 6 decimal places kept (1.123456)
    expect(usdcHumanToRaw("1.1234567")).toBe("1123456");
  });
  it("handles zero fractional padding", () => {
    expect(usdcHumanToRaw("1.5")).toBe("1500000");
  });
  it("throws on empty/invalid input", () => {
    expect(() => usdcHumanToRaw("")).toThrow();
    expect(() => usdcHumanToRaw("abc")).toThrow();
    expect(() => usdcHumanToRaw("1.2.3")).toThrow();
  });
});

describe("usdcRawToHuman", () => {
  it("converts round number", () => {
    expect(usdcRawToHuman("100000000")).toBe("100");
  });
  it("converts with decimals", () => {
    expect(usdcRawToHuman("100500000")).toBe("100.5");
  });
  it("handles zero", () => {
    expect(usdcRawToHuman("0")).toBe("0");
  });
  it("trims trailing zeros", () => {
    expect(usdcRawToHuman("1000001")).toBe("1.000001");
    expect(usdcRawToHuman("1000010")).toBe("1.00001");
  });
});

describe("usdcHumanToRaw round-trips", () => {
  it("round-trips 100.50", () => {
    expect(usdcRawToHuman(usdcHumanToRaw("100.50"))).toBe("100.5");
  });
  it("round-trips 0.000001 (1 micro-USDC)", () => {
    expect(usdcHumanToRaw("0.000001")).toBe("1");
    expect(usdcRawToHuman("1")).toBe("0.000001");
  });
});

describe("derivePtApy", () => {
  it("returns 0 when no discount (pt price >= 1)", () => {
    // 100 USDC in, 99 PT out — that's a premium, yield = 0
    expect(derivePtApy(100, 100, 180)).toBe(0); // exact parity = 0
  });
  it("computes positive APY when PT is at discount", () => {
    // 100 USDC → 100.67 PT, 63 days to expiry (approx USDe market from live probe)
    const apy = derivePtApy(100, 100.67, 63);
    // ptPrice = 100/100.67 ≈ 0.9933; yield = (1/0.9933 - 1) * (365/63) ≈ 3.9%
    expect(apy).toBeGreaterThan(3);
    expect(apy).toBeLessThan(5);
  });
  it("handles zero days gracefully", () => {
    expect(derivePtApy(100, 100.67, 0)).toBe(0);
  });
  it("handles zero amountOut gracefully", () => {
    expect(derivePtApy(100, 0, 90)).toBe(0);
  });
  it("annualizes correctly for 365-day market", () => {
    // 100 USDC → 105 PT over exactly 365 days → 5% APY
    const apy = derivePtApy(100, 105, 365);
    // ptPrice = 100/105 ≈ 0.9524; yield = (1/0.9524 - 1) * 1 ≈ 5%
    expect(apy).toBeCloseTo(5, 0);
  });
});
