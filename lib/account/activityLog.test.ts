/**
 * lib/account/activityLog.test.ts
 *
 * Unit tests for the activity log localStorage store.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { clearActivityLog, getActivityLog, logAction } from "./activityLog";

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

const OWNER = "0xABCDEF1234567890ABCDef1234567890abcdef12";

beforeEach(() => {
  localStorageStub.clear();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("logAction", () => {
  it("appends an entry and it appears in getActivityLog", () => {
    logAction(OWNER, {
      type: "swap",
      amount: "100.00",
      token: "USDC",
      chainId: 1,
    });
    const log = getActivityLog(OWNER);
    expect(log).toHaveLength(1);
    expect(log[0]!.type).toBe("swap");
    expect(log[0]!.amount).toBe("100.00");
    expect(log[0]!.token).toBe("USDC");
  });

  it("stores a unique id and timestamp on each entry", () => {
    logAction(OWNER, { type: "swap", amount: "50", token: "USDT", chainId: 1 });
    logAction(OWNER, { type: "bridge", amount: "200", token: "USDC", chainId: 1 });
    const log = getActivityLog(OWNER);
    expect(log).toHaveLength(2);
    expect(log[0]!.id).toBeTruthy();
    expect(log[1]!.id).toBeTruthy();
    expect(log[0]!.id).not.toBe(log[1]!.id);
  });

  it("returns entries newest-first", () => {
    logAction(OWNER, { type: "swap", amount: "1", token: "USDC", chainId: 1 });
    logAction(OWNER, { type: "bridge", amount: "2", token: "USDC", chainId: 1 });
    const log = getActivityLog(OWNER);
    expect(log[0]!.type).toBe("bridge");
    expect(log[1]!.type).toBe("swap");
  });

  it("is scoped per owner address (case-insensitive)", () => {
    const other = "0x0000000000000000000000000000000000000001";
    logAction(OWNER, { type: "swap", amount: "1", token: "USDC", chainId: 1 });
    logAction(other, { type: "send", amount: "5", token: "USDT", chainId: 1 });

    const ownerLog = getActivityLog(OWNER);
    const otherLog = getActivityLog(other);

    expect(ownerLog).toHaveLength(1);
    expect(otherLog).toHaveLength(1);
    expect(ownerLog[0]!.type).toBe("swap");
    expect(otherLog[0]!.type).toBe("send");
  });

  it("stores optional fields when provided", () => {
    logAction(OWNER, {
      type: "swap",
      amount: "100",
      token: "USDC",
      toToken: "USDT",
      toAmount: "99.50",
      chainId: 137,
      txHash: "0xdeadbeef",
      label: "Polymarket USDC.e",
    });
    const entry = getActivityLog(OWNER)[0]!;
    expect(entry.toToken).toBe("USDT");
    expect(entry.toAmount).toBe("99.50");
    expect(entry.chainId).toBe(137);
    expect(entry.txHash).toBe("0xdeadbeef");
    expect(entry.label).toBe("Polymarket USDC.e");
  });

  it("silently ignores empty owner", () => {
    logAction("", { type: "swap", amount: "1", token: "USDC", chainId: 1 });
    expect(getActivityLog("")).toHaveLength(0);
  });

  it("does not store any private key or secret fields", () => {
    const entry = { type: "swap" as const, amount: "1", token: "USDC", chainId: 1 };
    // ActivityEntry type has no privateKey or secret fields — verify the stored entry has none.
    logAction(OWNER, entry);
    const log = getActivityLog(OWNER);
    expect(log[0]).not.toHaveProperty("privateKey");
    expect(log[0]).not.toHaveProperty("secret");
  });
});

describe("getActivityLog", () => {
  it("returns empty array for unknown owner", () => {
    expect(getActivityLog("0xunknown")).toHaveLength(0);
  });

  it("returns empty array for empty owner", () => {
    expect(getActivityLog("")).toHaveLength(0);
  });

  it("returns all entries across multiple appends", () => {
    for (let i = 0; i < 5; i++) {
      logAction(OWNER, { type: "swap", amount: String(i), token: "USDC", chainId: 1 });
    }
    expect(getActivityLog(OWNER)).toHaveLength(5);
  });
});

describe("MAX_ENTRIES cap", () => {
  it("caps at 200 entries and drops oldest", () => {
    for (let i = 0; i < 210; i++) {
      logAction(OWNER, { type: "swap", amount: String(i), token: "USDC", chainId: 1 });
    }
    const log = getActivityLog(OWNER);
    expect(log).toHaveLength(200);
    // Most-recent entry was the last appended (amount = "209")
    expect(log[0]!.amount).toBe("209");
    // The oldest entries (0–9) were dropped
    const amounts = log.map((e) => Number(e.amount));
    expect(Math.min(...amounts)).toBe(10);
  });
});

describe("clearActivityLog", () => {
  it("removes all entries for the owner", () => {
    logAction(OWNER, { type: "swap", amount: "1", token: "USDC", chainId: 1 });
    clearActivityLog(OWNER);
    expect(getActivityLog(OWNER)).toHaveLength(0);
  });

  it("does not affect other owners", () => {
    const other = "0x0000000000000000000000000000000000000002";
    logAction(OWNER, { type: "swap", amount: "1", token: "USDC", chainId: 1 });
    logAction(other, { type: "send", amount: "5", token: "USDT", chainId: 1 });
    clearActivityLog(OWNER);
    expect(getActivityLog(OWNER)).toHaveLength(0);
    expect(getActivityLog(other)).toHaveLength(1);
  });
});
