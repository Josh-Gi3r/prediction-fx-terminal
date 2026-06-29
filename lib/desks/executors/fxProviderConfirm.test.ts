import { describe, expect, it } from "vitest";
import { fxFailedErrorMessage, fxTerminalDecision } from "./fxProviderConfirm";

describe("fxTerminalDecision", () => {
  it("returns 'pending' when terminal is false", () => {
    expect(fxTerminalDecision({ terminal: false })).toBe("pending");
  });

  it("returns 'pending' when terminal is absent", () => {
    expect(fxTerminalDecision({})).toBe("pending");
  });

  it("returns 'settled' when terminal + settled", () => {
    expect(fxTerminalDecision({ terminal: true, settled: true })).toBe("settled");
  });

  it("returns 'failed' when terminal + failed", () => {
    expect(fxTerminalDecision({ terminal: true, failed: true })).toBe("failed");
  });

  it("returns 'pending' when terminal but neither settled nor failed", () => {
    expect(fxTerminalDecision({ terminal: true })).toBe("pending");
  });

  it("settled takes precedence over failed when both set", () => {
    // settled checked first in the real code
    expect(fxTerminalDecision({ terminal: true, settled: true, failed: true })).toBe("settled");
  });
});

describe("fxFailedErrorMessage", () => {
  it("uses error_code when present", () => {
    expect(fxFailedErrorMessage({ error_code: "INSUFFICIENT_LIQUIDITY" })).toBe(
      "Swap failed: INSUFFICIENT_LIQUIDITY",
    );
  });

  it("uses error when error_code absent", () => {
    expect(fxFailedErrorMessage({ error: "route not found" })).toBe("route not found");
  });

  it("falls back to generic message when both absent", () => {
    expect(fxFailedErrorMessage({})).toBe("Swap failed on the FX provider.");
  });

  it("prefers error_code over error", () => {
    expect(fxFailedErrorMessage({ error_code: "CODE", error: "msg" })).toBe("Swap failed: CODE");
  });
});
