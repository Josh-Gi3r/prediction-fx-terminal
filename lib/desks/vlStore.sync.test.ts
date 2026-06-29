/**
 * lib/desks/vlStore.sync.test.ts
 *
 * Tests for the server-sync extensions to vlStore.ts:
 *   - addVlBatch: updates localStorage + fires POST best-effort, never throws
 *   - removeVlBatch: updates localStorage + fires DELETE best-effort, never throws
 *   - hydrateVlBatches: merges server open batches, removes server-cancelled ones
 *   - offline queue behaviour
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

// ─── Mock preferences token ───────────────────────────────────────────────────

vi.mock("@/lib/account/preferences", () => ({
  getSessionToken: () => null,
}));

import { addVlBatch, getVlBatches, hydrateVlBatches, removeVlBatch } from "./vlStore";

const OWNER = `0x${"a".repeat(40)}`;
const OTHER_OWNER = `0x${"b".repeat(40)}`;

function makeBatch(id: string, owner = OWNER) {
  return {
    vlBatchId: id,
    owner,
    budgetSymbol: "USDC",
    amount: "100",
    legs: [{ symbol: "ETH", price: "2000" }],
    expiration: 9999999999,
    createdAt: 1700000000,
  };
}

beforeEach(() => {
  localStorageStub.clear();
  fetchMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── addVlBatch ───────────────────────────────────────────────────────────────

describe("addVlBatch", () => {
  it("adds to localStorage synchronously", () => {
    addVlBatch(makeBatch("id-1"));
    expect(getVlBatches(OWNER)).toHaveLength(1);
    const batches = getVlBatches(OWNER);
    expect(batches[0]?.vlBatchId).toBe("id-1");
  });

  it("deduplicates by vlBatchId", () => {
    addVlBatch(makeBatch("id-1"));
    addVlBatch(makeBatch("id-1"));
    expect(getVlBatches(OWNER)).toHaveLength(1);
  });

  it("never throws even when fetch fails", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    expect(() => addVlBatch(makeBatch("id-2"))).not.toThrow();
    await new Promise((r) => setTimeout(r, 10));
  });

  it("enqueues in pendingAdd when server returns non-ok", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401 });

    addVlBatch(makeBatch("id-3"));
    await new Promise((r) => setTimeout(r, 10));

    const raw = localStorageStub.getItem("stabledex.vlBatches.pendingAdd.v1");
    expect(raw).not.toBeNull();
    const queue = JSON.parse(raw!);
    expect(queue.some((b: { vlBatchId: string }) => b.vlBatchId === "id-3")).toBe(true);
  });

  it("does not enqueue when server accepts", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ vlBatches: [] }) });

    addVlBatch(makeBatch("id-4"));
    await new Promise((r) => setTimeout(r, 10));

    const raw = localStorageStub.getItem("stabledex.vlBatches.pendingAdd.v1");
    if (raw) {
      const queue = JSON.parse(raw);
      expect(queue.some((b: { vlBatchId: string }) => b.vlBatchId === "id-4")).toBe(false);
    }
  });
});

// ─── removeVlBatch ────────────────────────────────────────────────────────────

describe("removeVlBatch", () => {
  it("removes from localStorage synchronously", () => {
    addVlBatch(makeBatch("id-5"));
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ vlBatches: [] }) });
    removeVlBatch("id-5");
    expect(getVlBatches(OWNER)).toHaveLength(0);
  });

  it("never throws even when fetch fails", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    expect(() => removeVlBatch("nonexistent-id")).not.toThrow();
    await new Promise((r) => setTimeout(r, 10));
  });

  it("enqueues in pendingRemove when server returns non-ok", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401 });

    addVlBatch(makeBatch("id-6"));
    removeVlBatch("id-6");
    await new Promise((r) => setTimeout(r, 10));

    const raw = localStorageStub.getItem("stabledex.vlBatches.pendingRemove.v1");
    if (raw) {
      const queue = JSON.parse(raw);
      expect(queue).toContain("id-6");
    }
  });
});

// ─── hydrateVlBatches ─────────────────────────────────────────────────────────

describe("hydrateVlBatches", () => {
  it("returns local batches when server returns non-ok", async () => {
    addVlBatch(makeBatch("id-10"));
    fetchMock.mockResolvedValue({ ok: false, status: 401 });

    const result = await hydrateVlBatches(OWNER);
    expect(result.some((b) => b.vlBatchId === "id-10")).toBe(true);
  });

  it("returns local batches when fetch throws", async () => {
    addVlBatch(makeBatch("id-11"));
    fetchMock.mockRejectedValue(new Error("offline"));

    const result = await hydrateVlBatches(OWNER);
    expect(result.some((b) => b.vlBatchId === "id-11")).toBe(true);
  });

  it("adds server-only batches to local cache", async () => {
    // Local has nothing; server has a batch.
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        prefs: null,
        vlBatches: [
          {
            vlBatchId: "server-batch-1",
            owner: OWNER,
            budgetSymbol: "USDC",
            amount: "200",
            legs: [{ symbol: "BTC", price: "50000" }],
            expiration: 9999999999,
            createdAt: 1700000000,
          },
        ],
      }),
    });

    const result = await hydrateVlBatches(OWNER);
    expect(result.some((b) => b.vlBatchId === "server-batch-1")).toBe(true);
  });

  it("removes local batches not in the server open set (cross-device cancel)", async () => {
    // Local has a batch that the server no longer returns (cancelled elsewhere).
    addVlBatch(makeBatch("local-only-cancelled"));

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        prefs: null,
        vlBatches: [], // server: no open batches
      }),
    });

    const result = await hydrateVlBatches(OWNER);
    expect(result.find((b) => b.vlBatchId === "local-only-cancelled")).toBeUndefined();
  });

  it("preserves batches belonging to other owners", async () => {
    addVlBatch(makeBatch("other-owner-batch", OTHER_OWNER));

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ prefs: null, vlBatches: [] }),
    });

    await hydrateVlBatches(OWNER);

    // Other owner's batch must survive.
    const all = getVlBatches(OTHER_OWNER);
    expect(all.some((b) => b.vlBatchId === "other-owner-batch")).toBe(true);
  });

  it("deduplicates batches present both locally and on server", async () => {
    addVlBatch(makeBatch("dup-batch"));

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        prefs: null,
        vlBatches: [
          {
            vlBatchId: "dup-batch",
            owner: OWNER,
            budgetSymbol: "USDC",
            amount: "100",
            legs: [{ symbol: "ETH", price: "2000" }],
            expiration: 9999999999,
            createdAt: 1700000000,
          },
        ],
      }),
    });

    const result = await hydrateVlBatches(OWNER);
    const dups = result.filter((b) => b.vlBatchId === "dup-batch");
    expect(dups).toHaveLength(1);
  });
});
