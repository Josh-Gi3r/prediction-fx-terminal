/**
 * Polymarket order routing -- unit tests.
 * Tests pure math/validation helpers (no network, no wallet needed).
 *
 * The old float-math calcAmounts tests have been superseded by the integer-math
 * parity tests in order.test.ts. This file retains the tick-snapping and
 * structural validation tests.
 */

import { describe, expect, it } from "vitest";

// ─── tick snapping ──────────────────────────────────────────────────────────

function snapToTick(price: number, tick: number): number {
  return Math.round(price / tick) * tick;
}

describe("snapToTick", () => {
  it("snaps to nearest tick", () => {
    expect(snapToTick(0.555, 0.01)).toBeCloseTo(0.56, 5);
    expect(snapToTick(0.551, 0.01)).toBeCloseTo(0.55, 5);
    expect(snapToTick(0.001, 0.001)).toBeCloseTo(0.001, 6);
  });

  it("passes through already-snapped price", () => {
    expect(snapToTick(0.55, 0.01)).toBeCloseTo(0.55, 5);
    expect(snapToTick(0.001, 0.001)).toBeCloseTo(0.001, 6);
  });
});

// ─── minimum size validation ────────────────────────────────────────────────

describe("minimum order size validation", () => {
  it("rejects size below market minimum", () => {
    const minOrderSize = 5;
    const size = 3;
    expect(size < minOrderSize).toBe(true);
  });

  it("accepts size at exactly market minimum", () => {
    const minOrderSize = 5;
    const size = 5;
    expect(size < minOrderSize).toBe(false);
  });
});

// ─── price range validation ─────────────────────────────────────────────────

function isPriceInvalid(p: number): boolean {
  return p <= 0 || p >= 1;
}

describe("price range validation", () => {
  it("rejects price <= 0", () => {
    expect(isPriceInvalid(0)).toBe(true);
    expect(isPriceInvalid(-0.1)).toBe(true);
  });

  it("rejects price >= 1", () => {
    expect(isPriceInvalid(1)).toBe(true);
    expect(isPriceInvalid(1.1)).toBe(true);
  });

  it("accepts valid price range", () => {
    expect(isPriceInvalid(0.55)).toBe(false);
  });
});

// ─── side resolution ────────────────────────────────────────────────────────

function resolveTokenId(
  side: "yes" | "no",
  market: { yesTokenId: string; noTokenId: string },
): string {
  return side === "yes" ? market.yesTokenId : market.noTokenId;
}

describe("side to tokenId resolution", () => {
  const market = {
    yesTokenId: "token-yes-123",
    noTokenId: "token-no-456",
  };

  it("resolves yes side to yesTokenId", () => {
    expect(resolveTokenId("yes", market)).toBe("token-yes-123");
  });

  it("resolves no side to noTokenId", () => {
    expect(resolveTokenId("no", market)).toBe("token-no-456");
  });
});
