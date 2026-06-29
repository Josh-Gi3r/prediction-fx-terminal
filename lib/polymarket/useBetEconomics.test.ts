/**
 * lib/polymarket/useBetEconomics.test.ts
 *
 * Proves that computeBetEconomics + derivePrice produce consistent on-chain
 * values regardless of which surface (shares vs USDC) drives the input.
 *
 * Key invariant:
 *   A given economic intent (same market, same side, same position size)
 *   must produce IDENTICAL (size, costRaw) from both input units.
 *
 * Secondary invariants:
 *   - Tick/min-size clamping applied exactly once.
 *   - No float drift in costRaw.
 *   - derivePrice matches expected tick-snapped values.
 */

import { describe, expect, it } from "vitest";
import { usdcToRaw } from "./order";
import {
  type BetMarketParams,
  PM_MIN_SIZE,
  computeBetEconomics,
  derivePrice,
  snapToTick,
} from "./useBetEconomics";

// ─── fixture market ────────────────────────────────────────────────────────────

const MARKET_38C: BetMarketParams = {
  yesPrice: 0.38,
  noPrice: 0.62,
  bestBid: 0.37,
  tickSize: 0.01,
  minOrderSize: 5,
  negRisk: false,
};

const MARKET_HIGH_TICK: BetMarketParams = {
  yesPrice: 0.7,
  noPrice: 0.3,
  bestBid: 0.69,
  tickSize: 0.1,
  minOrderSize: 10,
  negRisk: true,
};

const MARKET_MICRO_TICK: BetMarketParams = {
  yesPrice: 0.0037,
  noPrice: 0.9963,
  bestBid: 0.0036,
  tickSize: 0.0001,
  minOrderSize: 5,
  negRisk: false,
};

// ─── derivePrice ──────────────────────────────────────────────────────────────

describe("derivePrice", () => {
  it("snaps yesPrice to tick boundary", () => {
    // 0.38 is already on a 0.01 tick, so no change
    expect(derivePrice("yes", MARKET_38C)).toBe(0.38);
  });

  it("snaps noPrice to tick boundary", () => {
    expect(derivePrice("no", MARKET_38C)).toBe(0.62);
  });

  it("falls back to bestBid when yesPrice is null (snapped)", () => {
    const m: BetMarketParams = { ...MARKET_38C, yesPrice: null };
    expect(derivePrice("yes", m)).toBe(0.37);
  });

  it("falls back to 0.5 when all prices are null", () => {
    const m: BetMarketParams = { ...MARKET_38C, yesPrice: null, bestBid: null };
    expect(derivePrice("yes", m)).toBe(0.5);
  });

  it("uses customPrice over live price when valid", () => {
    expect(derivePrice("yes", MARKET_38C, 0.45)).toBe(0.45);
  });

  it("ignores customPrice <= 0", () => {
    expect(derivePrice("yes", MARKET_38C, 0)).toBe(0.38);
  });

  it("ignores customPrice >= 1", () => {
    expect(derivePrice("yes", MARKET_38C, 1)).toBe(0.38);
  });

  it("snaps customPrice to tick boundary", () => {
    // 0.383 with tick 0.01 -> 0.38
    expect(derivePrice("yes", MARKET_38C, 0.383)).toBe(0.38);
  });

  it("clamps price to [tick, 1-tick] for live price", () => {
    // Very small price should be clamped up to tickSize
    const m: BetMarketParams = { ...MARKET_38C, yesPrice: 0.001 };
    expect(derivePrice("yes", m)).toBe(0.01);
  });

  it("high-tick market: 0.7 snaps to 0.7 on 0.1 grid", () => {
    expect(derivePrice("yes", MARKET_HIGH_TICK)).toBeCloseTo(0.7, 6);
  });

  it("micro-tick: 0.0037 snaps to 0.0037 on 0.0001 grid", () => {
    expect(derivePrice("yes", MARKET_MICRO_TICK)).toBeCloseTo(0.0037, 6);
  });
});

// ─── computeBetEconomics: parity invariant ────────────────────────────────────

describe("computeBetEconomics: parity — same intent, same on-chain result", () => {
  /**
   * Core invariant test.
   *
   * Intent: buy YES at 38c, spending ~$10.
   * - Shares path: user enters 26 shares (26 * 0.38 = $9.88)
   * - USDC path: user enters $9.88
   *
   * Both must produce the same size + costRaw.
   */
  it("$10 YES at 38c: shares vs usdc produce identical size + costRaw", () => {
    const limitPrice = derivePrice("yes", MARKET_38C); // 0.38
    const minOrderSize = Math.max(PM_MIN_SIZE, MARKET_38C.minOrderSize); // 5

    // Shares path: user enters 26
    const sharesEcon = computeBetEconomics("shares", 26, limitPrice, minOrderSize);

    // USDC path: user enters $9.88 (= 26 * 0.38)
    const usdcEcon = computeBetEconomics("usdc", 9.88, limitPrice, minOrderSize);

    expect(sharesEcon.size).toBe(usdcEcon.size);
    expect(sharesEcon.costRaw).toBe(usdcEcon.costRaw);
    expect(sharesEcon.limitPrice).toBe(usdcEcon.limitPrice);
  });

  it("$25 YES at 38c: shares vs usdc produce identical size + costRaw", () => {
    const limitPrice = derivePrice("yes", MARKET_38C);
    const minOrderSize = Math.max(PM_MIN_SIZE, MARKET_38C.minOrderSize);

    // floor(25 / 0.38) = 65 shares
    const expectedShares = Math.floor(25 / limitPrice);
    const usdcEcon = computeBetEconomics("usdc", 25, limitPrice, minOrderSize);
    const sharesEcon = computeBetEconomics("shares", expectedShares, limitPrice, minOrderSize);

    expect(sharesEcon.size).toBe(usdcEcon.size);
    expect(sharesEcon.costRaw).toBe(usdcEcon.costRaw);
  });

  it("NO side: $50 at 62c parity", () => {
    const limitPrice = derivePrice("no", MARKET_38C);
    const minOrderSize = Math.max(PM_MIN_SIZE, MARKET_38C.minOrderSize);

    const shares = Math.floor(50 / limitPrice);
    const sharesEcon = computeBetEconomics("shares", shares, limitPrice, minOrderSize);
    const usdcEcon = computeBetEconomics("usdc", 50, limitPrice, minOrderSize);

    expect(sharesEcon.size).toBe(usdcEcon.size);
    expect(sharesEcon.costRaw).toBe(usdcEcon.costRaw);
  });

  it("high-tick market: $100 YES at 70c parity", () => {
    const limitPrice = derivePrice("yes", MARKET_HIGH_TICK);
    const minOrderSize = Math.max(PM_MIN_SIZE, MARKET_HIGH_TICK.minOrderSize);

    const shares = Math.floor(100 / limitPrice);
    const sharesEcon = computeBetEconomics("shares", shares, limitPrice, minOrderSize);
    const usdcEcon = computeBetEconomics("usdc", 100, limitPrice, minOrderSize);

    expect(sharesEcon.size).toBe(usdcEcon.size);
    expect(sharesEcon.costRaw).toBe(usdcEcon.costRaw);
  });

  it("micro-tick market: $1000 YES at ~0.0037 parity", () => {
    const limitPrice = derivePrice("yes", MARKET_MICRO_TICK);
    const minOrderSize = Math.max(PM_MIN_SIZE, MARKET_MICRO_TICK.minOrderSize);

    const shares = Math.floor(1000 / limitPrice);
    const sharesEcon = computeBetEconomics("shares", shares, limitPrice, minOrderSize);
    const usdcEcon = computeBetEconomics("usdc", 1000, limitPrice, minOrderSize);

    expect(sharesEcon.size).toBe(usdcEcon.size);
    expect(sharesEcon.costRaw).toBe(usdcEcon.costRaw);
  });
});

// ─── min-size clamping ────────────────────────────────────────────────────────

describe("computeBetEconomics: min-size clamping", () => {
  it("shares input below minSize is clamped up to minSize", () => {
    const econ = computeBetEconomics("shares", 2, 0.38, 5);
    expect(econ.size).toBe(5); // clamped to PM_MIN_SIZE
  });

  it("usdc input that yields < minSize shares is clamped up", () => {
    // floor(1 / 0.38) = 2 shares < minSize=5 -- should clamp to 5
    const econ = computeBetEconomics("usdc", 1, 0.38, 5);
    expect(econ.size).toBe(5);
  });

  it("zero shares input clamps to minSize", () => {
    const econ = computeBetEconomics("shares", 0, 0.38, 5);
    expect(econ.size).toBe(5);
  });

  it("market minOrderSize > PM_MIN_SIZE is respected", () => {
    // minOrderSize = 10 (from MARKET_HIGH_TICK)
    const econ = computeBetEconomics("shares", 3, 0.7, 10);
    expect(econ.size).toBe(10);
  });

  it("shares exactly at minSize is not clamped further", () => {
    const econ = computeBetEconomics("shares", 5, 0.38, 5);
    expect(econ.size).toBe(5);
  });

  it("large shares input is not clamped down", () => {
    const econ = computeBetEconomics("shares", 1000, 0.38, 5);
    expect(econ.size).toBe(1000);
  });
});

// ─── costRaw derivation ────────────────────────────────────────────────────────

describe("computeBetEconomics: costRaw correctness", () => {
  it("costRaw = usdcToRaw(limitPrice * size), not usdcToRaw(rawDollarInput)", () => {
    // If user enters $10 but canonical shares = 26 at 0.38,
    // canonical cost = 26 * 0.38 = $9.88, not $10.
    const limitPrice = 0.38;
    const econ = computeBetEconomics("usdc", 10, limitPrice, 5);

    const expectedSize = Math.floor(10 / limitPrice); // 26
    const expectedCost = limitPrice * expectedSize; // 9.88
    const expectedCostRaw = usdcToRaw(expectedCost);

    expect(econ.size).toBe(expectedSize);
    expect(econ.costRaw).toBe(expectedCostRaw);
    // Not $10 raw
    expect(econ.costRaw).not.toBe(usdcToRaw(10));
  });

  it("costRaw uses ceil rounding -- approval always covers the exact order", () => {
    // 5 shares at 0.38 = $1.90 exactly -> 1_900_000 raw (no rounding needed)
    const econ = computeBetEconomics("shares", 5, 0.38, 5);
    expect(econ.costRaw).toBe(BigInt(1_900_000));
  });

  it("costRaw for awkward float price uses ceil", () => {
    // 7 * 0.07 in IEEE 754 = 0.49000...5 (above 0.49), ceil -> 490_001
    const econ = computeBetEconomics("shares", 7, 0.07, 5);
    expect(econ.costRaw).toBe(BigInt(490_001));
  });

  it("no float drift: 33 shares at 0.03 (tricky float territory)", () => {
    // 33 * 0.03 = 0.99 -> 990_000
    const econ = computeBetEconomics("shares", 33, 0.03, 5);
    expect(econ.costRaw).toBe(BigInt(990_000));
  });

  it("costRaw matches manually computed usdcToRaw", () => {
    const price = 0.62;
    const size = 80;
    const econ = computeBetEconomics("shares", size, price, 5);
    expect(econ.costRaw).toBe(usdcToRaw(price * size));
  });
});

// ─── payout / profit ──────────────────────────────────────────────────────────

describe("computeBetEconomics: payout + profit", () => {
  it("payout = size (1 share resolves to $1)", () => {
    const econ = computeBetEconomics("shares", 50, 0.38, 5);
    expect(econ.payout).toBe(50);
  });

  it("profit = payout - cost", () => {
    const econ = computeBetEconomics("shares", 50, 0.38, 5);
    expect(econ.profit).toBeCloseTo(econ.payout - econ.cost, 6);
  });

  it("payout > cost when price < 1 (positive expected value possible)", () => {
    const econ = computeBetEconomics("shares", 100, 0.38, 5);
    expect(econ.payout).toBeGreaterThan(econ.cost);
  });
});

// ─── display strings ──────────────────────────────────────────────────────────

describe("computeBetEconomics: display strings", () => {
  it("displayCost is formatted as $X.XX", () => {
    const econ = computeBetEconomics("shares", 26, 0.38, 5);
    expect(econ.displayCost).toMatch(/^\$[\d,]+\.\d{2}$/);
  });

  it("displayShares is a numeric string", () => {
    const econ = computeBetEconomics("shares", 1000, 0.38, 5);
    expect(econ.displayShares).toBe("1,000");
  });
});

// ─── snapToTick ───────────────────────────────────────────────────────────────

describe("snapToTick", () => {
  it("0.383 with tick 0.01 snaps to 0.38", () => {
    expect(snapToTick(0.383, 0.01)).toBeCloseTo(0.38, 6);
  });

  it("0.385 with tick 0.01 snaps to 0.39 (round half up)", () => {
    expect(snapToTick(0.385, 0.01)).toBeCloseTo(0.39, 6);
  });

  it("already on a tick boundary is unchanged", () => {
    expect(snapToTick(0.7, 0.1)).toBeCloseTo(0.7, 6);
  });

  it("0.0037 with tick 0.0001 is unchanged", () => {
    expect(snapToTick(0.0037, 0.0001)).toBeCloseTo(0.0037, 8);
  });
});
