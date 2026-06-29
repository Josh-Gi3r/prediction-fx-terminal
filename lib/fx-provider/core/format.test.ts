import { describe, expect, it } from "vitest";
import { fromRaw, toRaw } from "./format";

describe("toRaw", () => {
  it("converts human to raw at 6dp", () => {
    expect(toRaw("100", 6)).toBe("100000000");
    expect(toRaw("1.5", 6)).toBe("1500000");
    expect(toRaw("0.000001", 6)).toBe("1");
    expect(toRaw("0", 6)).toBe("0");
  });
  it("truncates excess fractional digits", () => {
    expect(toRaw("1.1234567", 6)).toBe("1123456");
  });
  it("handles 18dp", () => {
    expect(toRaw("1", 18)).toBe("1000000000000000000");
  });
});

describe("fromRaw", () => {
  it("converts raw to human at 6dp", () => {
    expect(fromRaw("100000000", 6)).toBe("100");
    expect(fromRaw("1500000", 6)).toBe("1.5");
    expect(fromRaw("1", 6)).toBe("0.000001");
    expect(fromRaw("0", 6)).toBe("0");
  });
  it("round-trips", () => {
    for (const v of ["100", "1.5", "0.000001", "123456.789012"]) {
      expect(fromRaw(toRaw(v, 6), 6)).toBe(v);
    }
  });
});
