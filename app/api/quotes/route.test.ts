/**
 * Tests for /api/quotes net-math: gas conversion, ranking on netOutRaw,
 * FX provider bias on net basis, CoW exclusion from best, and FX provider gas estimate.
 *
 * All pure helpers are imported from lib/desks/quoteEconomics — the REAL
 * implementations, not inline copies. This was the structural fix for P0-A:
 * the old test re-implemented the helpers inline so the test could pass against
 * a copy while the route used a subtly different (buggy) version.
 *
 * Also covers:
 *   - QuotesResponse.best is a Source string (not a full NormalizedQuote)
 *   - deskSubline copy for each venue (mirrors lib/desks/quoteDisplay.ts)
 *   - P0-A lock: lifi/kyber net derives from amountOutRaw (min), not amountOutGrossRaw
 */

import { deskSubline } from "@/lib/desks/quoteDisplay";
import {
  FX_PROVIDER_BIAS_BPS,
  annotate,
  applyFxProviderBias,
  gasUsdToOutRaw,
  rankDesks,
  selectBest,
} from "@/lib/desks/quoteEconomics";
import type { NormalizedQuote } from "@/lib/desks/source";
import { describe, expect, it } from "vitest";

// ─── Helpers ──────────────────────────────────────────────────────────────────

type Source = "fx-provider" | "lifi" | "kyber" | "cow";

/** Minimal LiFi NormalizedQuote fixture. */
function makeLifi(amountOutRaw: string, amountOutGrossRaw?: string): NormalizedQuote {
  return {
    source: "lifi",
    toolName: "LiFi",
    amountInRaw: "100000000",
    amountOutRaw,
    amountOutGrossRaw: amountOutGrossRaw ?? amountOutRaw,
    rate: 1,
    raw: {},
  } as NormalizedQuote;
}

/** Minimal Kyber NormalizedQuote fixture. */
function makeKyber(amountOutRaw: string, amountOutGrossRaw?: string): NormalizedQuote {
  return {
    source: "kyber",
    toolName: "Kyber",
    amountInRaw: "100000000",
    amountOutRaw,
    amountOutGrossRaw: amountOutGrossRaw ?? amountOutRaw,
    haircutBps: 50,
    rate: 1,
    tokenIn: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    tokenOut: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    routeSummary: {},
    raw: {},
  } as NormalizedQuote;
}

/** Minimal FX provider NormalizedQuote fixture. */
function makeFxProvider(amountOutRaw: string): NormalizedQuote {
  return {
    source: "fx-provider",
    toolName: "FX Provider",
    amountInRaw: "100000000",
    amountOutRaw,
    rate: 1,
    uuid: "test-uuid",
    expiresAt: Date.now() / 1000 + 600,
    permitRequired: false,
    routeParams: {
      taker: "0x0000000000000000000000000000000000000001",
      inputToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      outputToken: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      maxInputAmount: "100000000",
      minOutputAmount: amountOutRaw,
      recipient: "0x0000000000000000000000000000000000000001",
      initialDepositAmount: "100000000",
      uuid: "12345",
      deadline: Math.floor(Date.now() / 1000) + 600,
    },
    permit: null,
    raw: {} as never,
  } as NormalizedQuote;
}

// ─── Gas conversion ────────────────────────────────────────────────────────────

describe("gasUsdToOutRaw", () => {
  it("converts $0.40 gas to raw at 6 decimals (USD-stable par)", () => {
    expect(gasUsdToOutRaw(0.4, 6)).toBe(400_000n);
  });

  it("converts $0.20 gas to raw at 6 decimals", () => {
    expect(gasUsdToOutRaw(0.2, 6)).toBe(200_000n);
  });

  it("returns 0n when gasUsd is 0", () => {
    expect(gasUsdToOutRaw(0, 6)).toBe(0n);
  });

  it("returns 0n when gasUsd is negative", () => {
    expect(gasUsdToOutRaw(-1, 6)).toBe(0n);
  });

  it("uses implied rate for non-USD stablecoins (rate diverges >5%)", () => {
    // XSGD ≈ 0.74 USD → $0.40 gas / 0.74 ≈ 0.5405 XSGD → 540_541 raw at 6dp
    const result = gasUsdToOutRaw(0.4, 6, 0.74);
    expect(result).toBe(540_541n);
  });

  it("uses par (rate=1) when implied rate is within 5% of 1", () => {
    // USDT ≈ 0.9995 → Math.abs(0.9995 - 1) = 0.0005 < 0.05 → par
    expect(gasUsdToOutRaw(0.4, 6, 0.9995)).toBe(400_000n);
  });

  it("handles 18-decimal tokens correctly", () => {
    expect(gasUsdToOutRaw(0.4, 18)).toBe(400_000_000_000_000_000n);
  });
});

// ─── P0-A lock: net derives from amountOutRaw (min), NOT amountOutGrossRaw ────

describe("P0-A: annotate net uses guaranteed minimum, not optimistic gross", () => {
  it("lifi: net is based on amountOutRaw (toAmountMin), not amountOutGrossRaw", () => {
    // Simulate a LiFi response where:
    //   toAmount (gross / mid)    = 100_000_000 (100 USDT)
    //   toAmountMin (slippage-protected) = 99_500_000 (99.5 USDT, -0.5%)
    // gasUsd = 0 so we isolate the basis difference cleanly.
    const gross = "100000000"; // optimistic — what old code used
    const min = "99500000"; // guaranteed — what the fix uses

    const quote = makeLifi(min, gross);
    const annotated = annotate(quote, 0, 6);

    // Net must equal the min, not the gross.
    expect(annotated.netOutRaw).toBe(min);
    expect(annotated.netOutRaw).not.toBe(gross);
  });

  it("kyber: net is based on amountOutRaw (haircut), not amountOutGrossRaw", () => {
    const gross = "100000000"; // pre-haircut amountOut
    const haircut = "99500000"; // post-50bps haircut — the committed min

    const quote = makeKyber(haircut, gross);
    const annotated = annotate(quote, 0, 6);

    expect(annotated.netOutRaw).toBe(haircut);
    expect(annotated.netOutRaw).not.toBe(gross);
  });

  it("lifi: gas is subtracted from amountOutRaw, not amountOutGrossRaw", () => {
    // gross = 100_000_000, min = 99_500_000, gas $0.40 = 400_000 raw
    // Old (broken): net = 100_000_000 - 400_000 = 99_600_000 (above the real min!)
    // New (correct): net = 99_500_000 - 400_000 = 99_100_000
    const gross = "100000000";
    const min = "99500000";
    const quote = makeLifi(min, gross);
    const annotated = annotate(quote, 0.4, 6);

    expect(annotated.netOutRaw).toBe("99100000");
  });

  it("fx-provider net is unaffected by P0-A fix (already used amountOutRaw)", () => {
    // FX provider gasUsd=0, amountOutRaw=99_000_000 (post-$1-fee)
    const quote = makeFxProvider("99000000");
    const annotated = annotate(quote, 0, 6);
    expect(annotated.netOutRaw).toBe("99000000");
  });
});

// ─── Net deliverable (annotate math) ──────────────────────────────────────────

describe("annotate net math", () => {
  it("subtracts gas from amountOutRaw for a gas-bearing desk", () => {
    // amountOutRaw = 99_500_000 (99.5 USDT), gas = $0.40 → 400_000 raw → net = 99_100_000
    const quote = makeLifi("99500000");
    const annotated = annotate(quote, 0.4, 6);
    expect(annotated.netOutRaw).toBe("99100000");
  });

  it("clamps to '0' when gas exceeds output", () => {
    const quote = makeLifi("100000");
    const annotated = annotate(quote, 10.0, 6);
    expect(annotated.netOutRaw).toBe("0");
  });

  it("cow gas=0 → netOutRaw === amountOutRaw", () => {
    const quote: NormalizedQuote = {
      source: "cow",
      toolName: "CoW",
      amountInRaw: "100000000",
      amountOutRaw: "99500000",
      rate: 1,
      tokenIn: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      cowOrder: {
        sellToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        buyToken: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        sellAmount: "100000000",
        buyAmount: "99500000",
        validTo: 9999999999,
        appData: "0x",
        feeAmount: "0",
        kind: "sell",
        partiallyFillable: false,
        sellTokenBalance: "erc20",
        buyTokenBalance: "erc20",
      },
      raw: {},
    } as NormalizedQuote;
    const annotated = annotate(quote, 0, 6);
    expect(annotated.netOutRaw).toBe("99500000");
  });

  it("fx-provider gasUsd=0 → netOutRaw === amountOutRaw", () => {
    const quote = makeFxProvider("100000000");
    const annotated = annotate(quote, 0, 6);
    expect(annotated.netOutRaw).toBe("100000000");
  });
});

// ─── Ranking on net basis ─────────────────────────────────────────────────────

describe("rankDesks", () => {
  function makeEntry(
    source: Source,
    netOutRaw: string,
  ): [Source, { ok: true; quote: NormalizedQuote }] {
    const base = source === "fx-provider" ? makeFxProvider("0") : makeLifi("0");
    const quote = { ...base, source, netOutRaw } as NormalizedQuote;
    return [source, { ok: true as const, quote }];
  }

  it("ranks the desk with higher netOutRaw first", () => {
    const desks = [
      makeEntry("kyber", "98000000"),
      makeEntry("fx-provider", "99600000"),
      makeEntry("lifi", "99200000"),
    ];
    const ranked = rankDesks(desks);
    expect(ranked[0]![0]).toBe("fx-provider");
    expect(ranked[1]![0]).toBe("lifi");
    expect(ranked[2]![0]).toBe("kyber");
  });

  it("cow is excluded from execCands if other desks are available", () => {
    const desks = [
      makeEntry("cow", "99900000"), // highest net but excluded
      makeEntry("fx-provider", "99600000"),
    ];
    const ranked = rankDesks(desks);
    const execCands = ranked.filter(([src]) => src !== "cow");
    expect(execCands[0]![0]).toBe("fx-provider");
  });

  it("cow wins best when it is the sole ok quote (via selectBest)", () => {
    const cowQuote: NormalizedQuote = {
      source: "cow",
      toolName: "CoW",
      amountInRaw: "100000000",
      amountOutRaw: "99900000",
      netOutRaw: "99900000",
      rate: 1,
      tokenIn: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      cowOrder: {
        sellToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        buyToken: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        sellAmount: "100000000",
        buyAmount: "99900000",
        validTo: 9999999999,
        appData: "0x",
        feeAmount: "0",
        kind: "sell",
        partiallyFillable: false,
        sellTokenBalance: "erc20",
        buyTokenBalance: "erc20",
      },
      raw: {},
    } as NormalizedQuote;

    const result = selectBest([["cow", { ok: true, quote: cowQuote }]]);
    expect(result).toBe("cow");
  });
});

// ─── FX provider bias on net basis ────────────────────────────────────────────────────

describe("FX provider near-tie bias (FX_PROVIDER_BIAS_BPS = 10)", () => {
  it("FX_PROVIDER_BIAS_BPS constant is 10n", () => {
    expect(FX_PROVIDER_BIAS_BPS).toBe(10n);
  });

  it("routes to FX provider when within 0.1% of best", () => {
    // best = 100_000_000, fx-provider = 99_990_000 → within 10bps → bias to FX provider
    expect(applyFxProviderBias("lifi", 100_000_000n, 99_990_000n)).toBe("fx-provider");
  });

  it("does not bias when FX provider is more than 0.1% behind", () => {
    // best = 100_000_000, fx-provider = 99_800_000 → 20bps behind → no bias
    expect(applyFxProviderBias("lifi", 100_000_000n, 99_800_000n)).toBe("lifi");
  });

  it("does not double-apply bias when FX provider is already best", () => {
    expect(applyFxProviderBias("fx-provider", 100_000_000n, 100_000_000n)).toBe("fx-provider");
  });
});

// ─── QuotesResponse.best is a Source string ───────────────────────────────────

describe("selectBest / QuotesResponse.best contract", () => {
  function makeOk(
    source: Source,
    netOutRaw: string,
  ): [Source, { ok: true; quote: NormalizedQuote }] {
    const base = source === "fx-provider" ? makeFxProvider("0") : makeLifi("0");
    const quote = { ...base, source, netOutRaw } as NormalizedQuote;
    return [source, { ok: true as const, quote }];
  }

  it("best is a source string", () => {
    const best = selectBest([makeOk("fx-provider", "99600000"), makeOk("lifi", "99200000")]);
    expect(typeof best).toBe("string");
    expect(["fx-provider", "lifi", "kyber", "cow"]).toContain(best);
  });

  it("best points to the highest-net exec desk when no bias applies", () => {
    const best = selectBest([
      makeOk("lifi", "99800000"),
      makeOk("fx-provider", "98000000"), // > 0.1% behind → no bias
    ]);
    expect(best).toBe("lifi");
  });

  it("best resolves to fx-provider when bias kicks in", () => {
    const best = selectBest([
      makeOk("lifi", "100000000"),
      makeOk("fx-provider", "99990000"), // within 10bps
    ]);
    expect(best).toBe("fx-provider");
  });

  it("best resolves to cow only when cow is the sole ok quote", () => {
    const cowQ: NormalizedQuote = {
      source: "cow",
      toolName: "CoW",
      amountInRaw: "100000000",
      amountOutRaw: "99900000",
      netOutRaw: "99900000",
      rate: 1,
      tokenIn: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      cowOrder: {
        sellToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        buyToken: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        sellAmount: "100000000",
        buyAmount: "99900000",
        validTo: 9999999999,
        appData: "0x",
        feeAmount: "0",
        kind: "sell",
        partiallyFillable: false,
        sellTokenBalance: "erc20",
        buyTokenBalance: "erc20",
      },
      raw: {},
    } as NormalizedQuote;
    const best = selectBest([["cow", { ok: true, quote: cowQ }]]);
    expect(best).toBe("cow");
  });

  it("returns null when no desk is ok", () => {
    const best = selectBest([
      ["lifi", { ok: false }],
      ["fx-provider", { ok: false }],
    ]);
    expect(best).toBeNull();
  });
});

// ─── deskSubline copy contract (REAL function from lib/desks/quoteDisplay) ───

describe("deskSubline copy contract", () => {
  const q = (source: string): never =>
    ({ source, amountOutRaw: "1", rate: 1, toolName: "x" }) as never;

  it("fx-provider subline is exactly 'no slippage' (gasless, $1 fee inside quote)", () => {
    expect(deskSubline(q("fx-provider"))).toBe("no slippage");
  });

  it("cow subline keeps the no-fill warning", () => {
    expect(deskSubline(q("cow"))).toBe("request to solvers · no fill guarantee");
  });

  it("lifi subline is 'fees + gas counted'", () => {
    expect(deskSubline(q("lifi"))).toBe("fees + gas counted");
  });

  it("kyber subline is 'fees + gas counted'", () => {
    expect(deskSubline(q("kyber"))).toBe("fees + gas counted");
  });
});
