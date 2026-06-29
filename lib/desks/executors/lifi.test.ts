import { describe, expect, it } from "vitest";
import type { LifiQuote } from "../source";
import { extractLifiOutputToken } from "./lifi";

describe("extractLifiOutputToken", () => {
  it("extracts token from action.toToken", () => {
    const quote = {
      source: "lifi",
      amountInRaw: "1000000",
      amountOutRaw: "999000",
      rate: 0.999,
      toolName: "Stargate",
      raw: {
        action: {
          toToken: {
            address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
            decimals: 6,
            symbol: "USDC",
          },
        },
      },
    } satisfies LifiQuote;

    const result = extractLifiOutputToken(quote);
    expect(result).toEqual({
      address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      decimals: 6,
      symbol: "USDC",
    });
  });

  it("returns null when raw has no action.toToken", () => {
    const quote = {
      source: "lifi",
      amountInRaw: "1000000",
      amountOutRaw: "999000",
      rate: 0.999,
      toolName: "Stargate",
      raw: {},
    } satisfies LifiQuote;

    expect(extractLifiOutputToken(quote)).toBeNull();
  });

  it("falls back to decimals=6 and symbol='tokens' when fields missing", () => {
    const quote = {
      source: "lifi",
      amountInRaw: "1000000",
      amountOutRaw: "999000",
      rate: 0.999,
      toolName: "Stargate",
      raw: {
        action: {
          toToken: {
            address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
          },
        },
      },
    } satisfies LifiQuote;

    const result = extractLifiOutputToken(quote);
    expect(result).toEqual({
      address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      decimals: 6,
      symbol: "tokens",
    });
  });
});
