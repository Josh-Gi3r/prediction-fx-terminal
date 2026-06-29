/**
 * lib/account/preferences.test.ts
 *
 * Unit tests for the AccountPrefs localStorage store.
 * Uses a simple localStorage stub — node environment, no DOM.
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
  type AccountPrefs,
  DEFAULT_PREFS,
  getSlippageDecimal,
  readPrefs,
  resetPrefs,
  writePrefs,
} from "./preferences";

// ─── localStorage stub ────────────────────────────────────────────────────────

const store: Record<string, string> = {};

const localStorageStub = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => {
    store[k] = v;
  },
  removeItem: (k: string) => {
    delete store[k];
  },
  clear: () => {
    for (const k of Object.keys(store)) delete store[k];
  },
  get length() {
    return Object.keys(store).length;
  },
  key: (i: number) => Object.keys(store)[i] ?? null,
};

// biome-ignore lint/suspicious/noExplicitAny: test stub
(globalThis as any).window = { localStorage: localStorageStub };

beforeEach(() => {
  localStorageStub.clear();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("readPrefs", () => {
  it("returns defaults when nothing is stored", () => {
    const prefs = readPrefs();
    expect(prefs).toEqual(DEFAULT_PREFS);
  });

  it("returns stored value when present", () => {
    writePrefs({ slippageBps: 100 });
    const prefs = readPrefs();
    expect(prefs.slippageBps).toBe(100);
  });

  it("merges stored partial with defaults (new fields get defaults)", () => {
    // Manually write a partial without the notifications key
    localStorageStub.setItem("app.account.prefs.v1", JSON.stringify({ slippageBps: 10 }));
    const prefs = readPrefs();
    expect(prefs.slippageBps).toBe(10);
    expect(prefs.notifications).toEqual(DEFAULT_PREFS.notifications);
  });

  it("returns defaults on malformed JSON", () => {
    localStorageStub.setItem("app.account.prefs.v1", "{bad json");
    const prefs = readPrefs();
    expect(prefs).toEqual(DEFAULT_PREFS);
  });
});

describe("writePrefs", () => {
  it("persists a single field", () => {
    writePrefs({ settlementStablecoin: "XSGD" });
    expect(readPrefs().settlementStablecoin).toBe("XSGD");
  });

  it("persists slippageBps and slippageCustom together", () => {
    writePrefs({ slippageBps: 75, slippageCustom: "0.75" });
    const prefs = readPrefs();
    expect(prefs.slippageBps).toBe(75);
    expect(prefs.slippageCustom).toBe("0.75");
  });

  it("returns the full merged prefs object", () => {
    const result = writePrefs({ oddsFormat: "american" });
    expect(result.oddsFormat).toBe("american");
    expect(result.slippageBps).toBe(DEFAULT_PREFS.slippageBps);
  });

  it("deep-merges notifications", () => {
    writePrefs({ notifications: { ...DEFAULT_PREFS.notifications, betFilled: false } });
    const prefs = readPrefs();
    expect(prefs.notifications.betFilled).toBe(false);
    expect(prefs.notifications.orderFilled).toBe(true); // default
  });

  it("does not overwrite existing keys when patching one notification", () => {
    writePrefs({ notifications: { ...DEFAULT_PREFS.notifications, p2p: false } });
    writePrefs({ notifications: { ...readPrefs().notifications, marketResolves: false } });
    const prefs = readPrefs();
    expect(prefs.notifications.p2p).toBe(false);
    expect(prefs.notifications.marketResolves).toBe(false);
    expect(prefs.notifications.betFilled).toBe(true);
  });
});

describe("resetPrefs", () => {
  it("clears stored prefs and returns defaults", () => {
    writePrefs({ slippageBps: 100, oddsFormat: "american" });
    const result = resetPrefs();
    expect(result).toEqual(DEFAULT_PREFS);
    expect(readPrefs()).toEqual(DEFAULT_PREFS);
  });
});

describe("getSlippageDecimal", () => {
  it("returns 0.005 for default 50 bps", () => {
    expect(getSlippageDecimal()).toBeCloseTo(0.005);
  });

  it("returns 0.001 for 10 bps", () => {
    writePrefs({ slippageBps: 10 });
    expect(getSlippageDecimal()).toBeCloseTo(0.001);
  });

  it("returns 0.01 for 100 bps", () => {
    writePrefs({ slippageBps: 100 });
    expect(getSlippageDecimal()).toBeCloseTo(0.01);
  });

  it("returns correct value for custom bps (75 = 0.75%)", () => {
    writePrefs({ slippageBps: 75 });
    expect(getSlippageDecimal()).toBeCloseTo(0.0075);
  });
});

describe("DEFAULT_PREFS shape", () => {
  it("has expected keys", () => {
    expect(DEFAULT_PREFS).toHaveProperty("slippageBps");
    expect(DEFAULT_PREFS).toHaveProperty("settlementStablecoin");
    expect(DEFAULT_PREFS).toHaveProperty("defaultChain");
    expect(DEFAULT_PREFS).toHaveProperty("oddsFormat");
    expect(DEFAULT_PREFS).toHaveProperty("notifications");
  });

  it("notifications has all four keys", () => {
    expect(DEFAULT_PREFS.notifications).toHaveProperty("betFilled");
    expect(DEFAULT_PREFS.notifications).toHaveProperty("orderFilled");
    expect(DEFAULT_PREFS.notifications).toHaveProperty("marketResolves");
    expect(DEFAULT_PREFS.notifications).toHaveProperty("p2p");
  });
});
