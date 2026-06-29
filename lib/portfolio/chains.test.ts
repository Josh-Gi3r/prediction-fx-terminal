/**
 * lib/portfolio/chains.test.ts
 *
 * Unit tests for the pure (non-hook) helpers in lib/portfolio/chains.ts.
 * No network, no viem clients, no React.
 */

import { describe, expect, it } from "vitest";
import {
  BASE_TOKENS,
  CHAIN_CONFIGS,
  ETH_STATIC_TOKENS,
  POLYGON_TOKENS,
  mapTokenBalances,
  rawToHuman,
  stableUsd,
  sumChainUsd,
} from "./chains";
import type { ChainBalances } from "./chains";

// ─── rawToHuman ───────────────────────────────────────────────────────────────

describe("rawToHuman", () => {
  it("converts 6-decimal USDC raw to human", () => {
    expect(rawToHuman(1_000_000n, 6)).toBe(1);
    expect(rawToHuman(5_500_000n, 6)).toBeCloseTo(5.5);
    expect(rawToHuman(0n, 6)).toBe(0);
  });

  it("converts 18-decimal ETH raw to human", () => {
    expect(rawToHuman(1_000_000_000_000_000_000n, 18)).toBe(1);
    expect(rawToHuman(21_000_000_000_000_000n, 18)).toBeCloseTo(0.021);
  });

  it("handles large stable balances", () => {
    // 10,000 USDC (6 decimals)
    expect(rawToHuman(10_000_000_000n, 6)).toBe(10_000);
  });
});

// ─── stableUsd ────────────────────────────────────────────────────────────────

describe("stableUsd", () => {
  it("returns human value for USDC", () => {
    expect(stableUsd("USDC", 150.75)).toBe(150.75);
  });

  it("returns human value for USDC.e (bridged)", () => {
    expect(stableUsd("USDC.e", 200)).toBe(200);
  });

  it("returns human value for USDT", () => {
    expect(stableUsd("USDT", 300)).toBe(300);
  });

  it("returns null for a non-stable symbol", () => {
    expect(stableUsd("WBTC", 1)).toBeNull();
    expect(stableUsd("WETH", 3000)).toBeNull();
  });

  it("returns 0 for a stable with zero balance", () => {
    expect(stableUsd("USDC", 0)).toBe(0);
  });
});

// ─── mapTokenBalances ─────────────────────────────────────────────────────────

describe("mapTokenBalances", () => {
  it("maps raw results to TokenBalance correctly", () => {
    const tokens = ETH_STATIC_TOKENS;
    const raws = [500_000_000n, 250_000_000n]; // 500 USDC, 250 USDT
    const result = mapTokenBalances(tokens, raws);

    expect(result).toHaveLength(2);

    const usdc = result[0]!;
    expect(usdc.token.symbol).toBe("USDC");
    expect(usdc.raw).toBe(500_000_000n);
    expect(usdc.human).toBeCloseTo(500);
    expect(usdc.usd).toBeCloseTo(500);

    const usdt = result[1]!;
    expect(usdt.token.symbol).toBe("USDT");
    expect(usdt.human).toBeCloseTo(250);
    expect(usdt.usd).toBeCloseTo(250);
  });

  it("uses 0n for null/undefined results (chain failure resilience)", () => {
    const tokens = POLYGON_TOKENS.slice(0, 2);
    const result = mapTokenBalances(tokens, [null, undefined]);

    expect(result[0]!.raw).toBe(0n);
    expect(result[0]!.human).toBe(0);
    expect(result[1]!.raw).toBe(0n);
  });

  it("handles mixed success/failure", () => {
    const tokens = BASE_TOKENS;
    const result = mapTokenBalances(tokens, [1_000_000n]);
    expect(result[0]!.human).toBeCloseTo(1);
    expect(result[0]!.usd).toBeCloseTo(1);
  });
});

// ─── sumChainUsd ──────────────────────────────────────────────────────────────

describe("sumChainUsd", () => {
  it("sums USD across all chains", () => {
    const mockChains: ChainBalances[] = [
      {
        chainId: 1,
        nativeHuman: 0.01,
        nativeRaw: 10_000_000_000_000_000n,
        tokens: [
          {
            token: ETH_STATIC_TOKENS[0]!,
            raw: 100_000_000n,
            human: 100,
            usd: 100,
          },
        ],
        loading: false,
        error: null,
      },
      {
        chainId: 137,
        nativeHuman: 0,
        nativeRaw: 0n,
        tokens: [
          {
            token: POLYGON_TOKENS[0]!,
            raw: 50_000_000n,
            human: 50,
            usd: 50,
          },
        ],
        loading: false,
        error: null,
      },
    ];

    expect(sumChainUsd(mockChains)).toBe(150);
  });

  it("returns 0 when all chains have zero balances", () => {
    const emptyChains: ChainBalances[] = CHAIN_CONFIGS.map((c) => ({
      chainId: c.id,
      nativeHuman: 0,
      nativeRaw: 0n,
      tokens: c.tokens.map((t) => ({ token: t, raw: 0n, human: 0, usd: null })),
      loading: false,
      error: null,
    }));
    expect(sumChainUsd(emptyChains)).toBe(0);
  });

  it("ignores non-stable tokens (null usd)", () => {
    const chain: ChainBalances = {
      chainId: 1,
      nativeHuman: 2,
      nativeRaw: 2_000_000_000_000_000_000n,
      tokens: [
        {
          token: { ...ETH_STATIC_TOKENS[0]!, symbol: "WETH" },
          raw: 1_000_000_000_000_000_000n,
          human: 1,
          usd: null, // non-stable
        },
        {
          token: ETH_STATIC_TOKENS[0]!,
          raw: 200_000_000n,
          human: 200,
          usd: 200,
        },
      ],
      loading: false,
      error: null,
    };
    expect(sumChainUsd([chain])).toBe(200);
  });
});

// ─── CHAIN_CONFIGS shape ──────────────────────────────────────────────────────

describe("CHAIN_CONFIGS", () => {
  it("has exactly 3 chains: Ethereum, Polygon, Base", () => {
    expect(CHAIN_CONFIGS).toHaveLength(3);
    const ids = CHAIN_CONFIGS.map((c) => c.id);
    expect(ids).toContain(1); // mainnet
    expect(ids).toContain(137); // polygon
    expect(ids).toContain(8453); // base
  });

  it("each chain has at least one token", () => {
    for (const c of CHAIN_CONFIGS) {
      expect(c.tokens.length).toBeGreaterThan(0);
    }
  });

  it("Polygon includes USDC.e at the canonical address", () => {
    const poly = CHAIN_CONFIGS.find((c) => c.id === 137);
    expect(poly).toBeDefined();
    const usdce = poly!.tokens.find((t) => t.symbol === "USDC.e");
    expect(usdce).toBeDefined();
    expect(usdce!.address.toLowerCase()).toBe("0x2791bca1f2de4661ed88a30c99a7a9449aa84174");
    expect(usdce!.primaryAction).toBe("bet");
  });

  it("Base USDC has primaryAction=p2p", () => {
    const baseChain = CHAIN_CONFIGS.find((c) => c.id === 8453);
    expect(baseChain).toBeDefined();
    expect(baseChain!.tokens[0]!.primaryAction).toBe("p2p");
  });

  it("explorerAddr builds correct URLs", () => {
    const addr = "0xabc";
    const eth = CHAIN_CONFIGS.find((c) => c.id === 1);
    expect(eth!.explorerAddr(addr)).toBe(`https://etherscan.io/address/${addr}`);
    const poly = CHAIN_CONFIGS.find((c) => c.id === 137);
    expect(poly!.explorerAddr(addr)).toBe(`https://polygonscan.com/address/${addr}`);
    const b = CHAIN_CONFIGS.find((c) => c.id === 8453);
    expect(b!.explorerAddr(addr)).toBe(`https://basescan.org/address/${addr}`);
  });
});

// ─── Token list shape ─────────────────────────────────────────────────────────

describe("token lists", () => {
  it("ETH_STATIC_TOKENS has USDC and USDT", () => {
    const symbols = ETH_STATIC_TOKENS.map((t) => t.symbol);
    expect(symbols).toContain("USDC");
    expect(symbols).toContain("USDT");
  });

  it("POLYGON_TOKENS has USDC.e, USDC native and USDT", () => {
    const symbols = POLYGON_TOKENS.map((t) => t.symbol);
    expect(symbols).toContain("USDC.e");
    expect(symbols).toContain("USDC");
    expect(symbols).toContain("USDT");
  });

  it("all token addresses are checksummed 0x strings", () => {
    const allTokens = [...ETH_STATIC_TOKENS, ...POLYGON_TOKENS, ...BASE_TOKENS];
    for (const t of allTokens) {
      expect(t.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    }
  });
});
