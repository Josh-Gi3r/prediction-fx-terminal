import { describe, expect, it } from "vitest";
import { formatTokenAmount } from "./shared";

describe("formatTokenAmount", () => {
  it("formats 6-decimal stablecoin amount", () => {
    expect(formatTokenAmount(1_500_000n, 6)).toBe("1.5");
  });

  it("formats whole numbers without decimal point", () => {
    expect(formatTokenAmount(5_000_000n, 6)).toBe("5");
  });

  it("handles zero decimals (returns raw string)", () => {
    expect(formatTokenAmount(42n, 0)).toBe("42");
  });

  it("handles negative decimals (returns raw string)", () => {
    expect(formatTokenAmount(42n, -1)).toBe("42");
  });

  it("strips trailing zeros in fractional part", () => {
    // 1.50 → "1.5"
    expect(formatTokenAmount(1_500_000n, 6)).toBe("1.5");
  });

  it("handles sub-unit amounts (less than 1)", () => {
    // 0.000001 in 6 decimals
    expect(formatTokenAmount(1n, 6)).toBe("0.000001");
  });

  it("handles 18-decimal amounts", () => {
    // 1.5 ETH in 18 decimals
    expect(formatTokenAmount(1_500_000_000_000_000_000n, 18)).toBe("1.5");
  });

  it("handles large amounts", () => {
    expect(formatTokenAmount(1_000_000_000_000n, 6)).toBe("1000000");
  });
});
