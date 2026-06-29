import { describe, expect, it } from "vitest";
import { buildOrderAmounts } from "./orders";

// The two pre-merge call sites (DeliverableDrawer vs EntryPanel) computed these
// amounts two contradictory ways with float math. This pins the one true
// implementation: sizeBase is base units, price is quote-per-base, bid pays
// quote, ask pays base — exact integer math throughout.
describe("buildOrderAmounts", () => {
  it("bid: pays quote (size*price in quote decimals), receives base", () => {
    const r = buildOrderAmounts({
      side: "bid",
      sizeBase: "100",
      price: "0.92",
      baseDecimals: 6,
      quoteDecimals: 6,
    });
    expect(r.fromAmountRaw).toBe("92000000");
    expect(r.toAmountRaw).toBe("100000000");
  });

  it("ask: pays base, receives quote", () => {
    const r = buildOrderAmounts({
      side: "ask",
      sizeBase: "100",
      price: "0.92",
      baseDecimals: 6,
      quoteDecimals: 6,
    });
    expect(r.fromAmountRaw).toBe("100000000");
    expect(r.toAmountRaw).toBe("92000000");
  });

  it("mixed decimals (6-dec base, 18-dec quote) — no float drift at scale", () => {
    const r = buildOrderAmounts({
      side: "ask",
      sizeBase: "12345.678901",
      price: "36123.4567",
      baseDecimals: 6,
      quoteDecimals: 18,
    });
    expect(r.fromAmountRaw).toBe("12345678901");
    // 12345.678901 * 36123.4567 = 445968597.2123770867 exactly (verified with
    // arbitrary-precision integer arithmetic) — float64 would already drift here.
    expect(r.toAmountRaw).toBe("445968597212377086700000000");
  });

  it("rounds down (never signs for more output than the math allows)", () => {
    const r = buildOrderAmounts({
      side: "bid",
      sizeBase: "1",
      price: "0.333333",
      baseDecimals: 6,
      quoteDecimals: 2,
    });
    // 1 * 0.333333 at 2 decimals = 33.3333 → floor → 33
    expect(r.fromAmountRaw).toBe("33");
  });
});
