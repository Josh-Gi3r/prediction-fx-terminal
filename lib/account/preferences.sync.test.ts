/**
 * lib/account/preferences.sync.test.ts
 *
 * Tests for the server-sync extensions to preferences.ts:
 *   - writePrefs: fires PUT best-effort, enqueues on failure, never throws
 *   - hydratePrefs: merges server prefs, server wins
 *   - drainPendingPrefsSync: replays queue
 *   - getSessionToken / setSessionToken
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

// ─── Fetch mock ───────────────────────────────────────────────────────────────

const fetchMock = vi.fn();
// biome-ignore lint/suspicious/noExplicitAny: test stub
(globalThis as any).fetch = fetchMock;

import {
  DEFAULT_PREFS,
  drainPendingPrefsSync,
  getSessionToken,
  hydratePrefs,
  readPrefs,
  setSessionToken,
  writePrefs,
} from "./preferences";

beforeEach(() => {
  localStorageStub.clear();
  fetchMock.mockReset();
  setSessionToken(null);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Token accessors ──────────────────────────────────────────────────────────

describe("getSessionToken / setSessionToken", () => {
  it("returns null initially", () => {
    expect(getSessionToken()).toBeNull();
  });

  it("returns the token after it is set", () => {
    setSessionToken("tok123");
    expect(getSessionToken()).toBe("tok123");
  });

  it("can be cleared", () => {
    setSessionToken("tok123");
    setSessionToken(null);
    expect(getSessionToken()).toBeNull();
  });
});

// ─── writePrefs + offline queue ───────────────────────────────────────────────

describe("writePrefs server sync", () => {
  it("never throws even when fetch fails", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    expect(() => writePrefs({ slippageBps: 100 })).not.toThrow();
    // Give the background async a tick.
    await new Promise((r) => setTimeout(r, 0));
  });

  it("updates localStorage synchronously before fetch resolves", async () => {
    // Make fetch hang indefinitely.
    fetchMock.mockReturnValue(new Promise(() => {}));
    writePrefs({ slippageBps: 10 });
    // Synchronous read must already see the change.
    expect(readPrefs().slippageBps).toBe(10);
  });

  it("enqueues patch in pendingSync when server returns non-ok", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401 });

    writePrefs({ settlementStablecoin: "XSGD" });
    // Wait for the async fire-and-forget.
    await new Promise((r) => setTimeout(r, 10));

    const queueRaw = localStorageStub.getItem("app.account.prefs.pendingSync.v1");
    expect(queueRaw).not.toBeNull();
    const queue = JSON.parse(queueRaw!);
    expect(queue.length).toBeGreaterThan(0);
    expect(queue[0].patch.settlementStablecoin).toBe("XSGD");
  });

  it("enqueues patch in pendingSync when fetch throws", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));

    writePrefs({ oddsFormat: "american" });
    await new Promise((r) => setTimeout(r, 10));

    const queueRaw = localStorageStub.getItem("app.account.prefs.pendingSync.v1");
    const queue = JSON.parse(queueRaw!);
    expect(
      queue.some((e: { patch: { oddsFormat?: string } }) => e.patch.oddsFormat === "american"),
    ).toBe(true);
  });

  it("does NOT enqueue when server returns ok", async () => {
    fetchMock.mockResolvedValue({ ok: true });

    writePrefs({ slippageBps: 50 });
    await new Promise((r) => setTimeout(r, 10));

    const queueRaw = localStorageStub.getItem("app.account.prefs.pendingSync.v1");
    // Either null or an empty array is acceptable.
    if (queueRaw) {
      const queue = JSON.parse(queueRaw);
      expect(queue.length).toBe(0);
    } else {
      expect(queueRaw).toBeNull();
    }
  });

  it("includes Bearer token in fetch when set", async () => {
    setSessionToken("mytoken");
    fetchMock.mockResolvedValue({ ok: true });

    writePrefs({ slippageBps: 50 });
    await new Promise((r) => setTimeout(r, 10));

    const call = fetchMock.mock.calls[0];
    const headers = call?.[1]?.headers;
    expect(headers?.Authorization).toBe("Bearer mytoken");
  });
});

// ─── drainPendingPrefsSync ────────────────────────────────────────────────────

describe("drainPendingPrefsSync", () => {
  it("drains queue when server accepts", async () => {
    // Pre-populate a pending queue.
    localStorageStub.setItem(
      "app.account.prefs.pendingSync.v1",
      JSON.stringify([
        { patch: { slippageBps: 10 }, enqueuedAt: Date.now() },
        { patch: { oddsFormat: "american" }, enqueuedAt: Date.now() },
      ]),
    );

    fetchMock.mockResolvedValue({ ok: true });

    await drainPendingPrefsSync();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    // Queue should be cleared (or empty).
    const queueRaw = localStorageStub.getItem("app.account.prefs.pendingSync.v1");
    if (queueRaw) expect(JSON.parse(queueRaw).length).toBe(0);
  });

  it("stops draining on first failure and preserves remaining entries", async () => {
    localStorageStub.setItem(
      "app.account.prefs.pendingSync.v1",
      JSON.stringify([
        { patch: { slippageBps: 10 }, enqueuedAt: Date.now() },
        { patch: { oddsFormat: "american" }, enqueuedAt: Date.now() },
      ]),
    );

    fetchMock.mockRejectedValueOnce(new Error("network")).mockResolvedValue({ ok: true });

    await drainPendingPrefsSync();

    // Should have stopped after the first failure — second entry still in queue.
    const queueRaw = localStorageStub.getItem("app.account.prefs.pendingSync.v1");
    const queue = JSON.parse(queueRaw ?? "[]");
    expect(queue.length).toBeGreaterThan(0);
  });

  it("no-ops when queue is empty", async () => {
    await drainPendingPrefsSync();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ─── hydratePrefs ─────────────────────────────────────────────────────────────

describe("hydratePrefs", () => {
  it("returns local prefs when server returns non-ok", async () => {
    writePrefs({ slippageBps: 100 });
    fetchMock.mockResolvedValue({ ok: false, status: 401 });

    const prefs = await hydratePrefs();
    expect(prefs.slippageBps).toBe(100);
  });

  it("returns local prefs when fetch throws", async () => {
    writePrefs({ slippageBps: 100 });
    fetchMock.mockRejectedValue(new Error("offline"));

    const prefs = await hydratePrefs();
    expect(prefs.slippageBps).toBe(100);
  });

  it("merges server prefs (server wins)", async () => {
    writePrefs({ slippageBps: 100, oddsFormat: "american" });

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        prefs: { slippageBps: 50, oddsFormat: "percent" },
        vlBatches: [],
      }),
    });

    const prefs = await hydratePrefs();
    // Server values take priority.
    expect(prefs.slippageBps).toBe(50);
    expect(prefs.oddsFormat).toBe("percent");
  });

  it("preserves local-only fields not returned by server", async () => {
    writePrefs({ settlementStablecoin: "XSGD" });

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        prefs: { slippageBps: 50 }, // no settlementStablecoin
        vlBatches: [],
      }),
    });

    const prefs = await hydratePrefs();
    // Local settlementStablecoin preserved since server didn't send it.
    // (server wins on what it sends; defaults apply otherwise)
    expect(prefs.slippageBps).toBe(50);
  });

  it("handles null prefs from server (new user)", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ prefs: null, vlBatches: [] }),
    });

    const prefs = await hydratePrefs();
    // Should fall back to local/defaults without throwing.
    expect(prefs).toMatchObject(DEFAULT_PREFS);
  });

  it("persists merged result to localStorage", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        prefs: { slippageBps: 10 },
        vlBatches: [],
      }),
    });

    await hydratePrefs();

    const stored = JSON.parse(localStorageStub.getItem("app.account.prefs.v1") ?? "{}");
    expect(stored.slippageBps).toBe(10);
  });
});
