"use client";

// Lightweight client-side store of VL batches the user has posted, keyed by wallet.
// The FX provider's /orders listing is unreliable (returns 0 — see gotchas), so we track our
// own batch ids locally for the Positions view + cancel. localStorage, per-owner.
//
// Server sync:
//   - addVlBatch → also POSTs to /api/account/vl (best-effort, never throws).
//   - removeVlBatch → also DELETEs /api/account/vl/[id] (best-effort, never throws).
//   - hydrateVlBatches() → GETs /api/account/state and unions server open batches
//     into local cache. The cross-device cancel win: a batch cancelled elsewhere
//     won't reappear locally after hydration.

import { getSessionToken } from "@/lib/account/preferences";

export interface StoredVlBatch {
  vlBatchId: string; // primary leg's UUID4 order_id == cancel id
  owner: string;
  budgetSymbol: string;
  amount: string;
  legs: { symbol: string; price: string }[];
  expiration: number;
  createdAt: number; // unix seconds (passed in; no Date.now in shared code paths)
}

const KEY = "stabledex.vlBatches.v1";
const PENDING_ADD_KEY = "stabledex.vlBatches.pendingAdd.v1";
const PENDING_REMOVE_KEY = "stabledex.vlBatches.pendingRemove.v1";

function readAll(): StoredVlBatch[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

function writeAll(rows: StoredVlBatch[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(rows));
}

export function addVlBatch(b: StoredVlBatch) {
  const all = readAll().filter((x) => x.vlBatchId !== b.vlBatchId);
  all.unshift(b);
  writeAll(all);

  // Best-effort server sync.
  _syncAddToServer(b).catch(() => {});
}

export function getVlBatches(owner?: string): StoredVlBatch[] {
  if (!owner) return [];
  return readAll().filter((x) => x.owner.toLowerCase() === owner.toLowerCase());
}

export function removeVlBatch(vlBatchId: string) {
  writeAll(readAll().filter((x) => x.vlBatchId !== vlBatchId));

  // Best-effort server sync (soft-delete).
  _syncRemoveToServer(vlBatchId).catch(() => {});
}

// ─── Server sync ──────────────────────────────────────────────────────────────

function _buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getSessionToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function _syncAddToServer(b: StoredVlBatch): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const { owner: _owner, ...body } = b; // owner comes from session on server
    const res = await fetch("/api/account/vl", {
      method: "POST",
      headers: _buildHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      _enqueuePendingAdd(b);
    }
  } catch {
    _enqueuePendingAdd(b);
  }
}

async function _syncRemoveToServer(vlBatchId: string): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const res = await fetch(`/api/account/vl/${vlBatchId}`, {
      method: "DELETE",
      headers: _buildHeaders(),
    });
    if (!res.ok) {
      _enqueuePendingRemove(vlBatchId);
    }
  } catch {
    _enqueuePendingRemove(vlBatchId);
  }
}

// ─── Pending sync queues ──────────────────────────────────────────────────────

function _enqueuePendingAdd(b: StoredVlBatch): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(PENDING_ADD_KEY);
    const queue: StoredVlBatch[] = raw ? (JSON.parse(raw) as StoredVlBatch[]) : [];
    // Deduplicate by vlBatchId.
    const deduped = queue.filter((x) => x.vlBatchId !== b.vlBatchId);
    deduped.push(b);
    window.localStorage.setItem(PENDING_ADD_KEY, JSON.stringify(deduped.slice(-50)));
  } catch {
    // ignore
  }
}

function _enqueuePendingRemove(vlBatchId: string): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(PENDING_REMOVE_KEY);
    const queue: string[] = raw ? (JSON.parse(raw) as string[]) : [];
    if (!queue.includes(vlBatchId)) queue.push(vlBatchId);
    window.localStorage.setItem(PENDING_REMOVE_KEY, JSON.stringify(queue.slice(-50)));
  } catch {
    // ignore
  }
}

/**
 * Drain pending add/remove queues. Called by hydrateVlBatches after login.
 */
async function _drainPendingQueues(): Promise<void> {
  if (typeof window === "undefined") return;

  // Drain removes first (cancellations take priority).
  const removeRaw = window.localStorage.getItem(PENDING_REMOVE_KEY);
  const toRemove: string[] = removeRaw ? (JSON.parse(removeRaw) as string[]) : [];
  const remainingRemoves: string[] = [];
  for (const id of toRemove) {
    try {
      const res = await fetch(`/api/account/vl/${id}`, {
        method: "DELETE",
        headers: _buildHeaders(),
      });
      if (!res.ok) {
        remainingRemoves.push(id);
        break;
      }
    } catch {
      remainingRemoves.push(id);
      break;
    }
  }
  try {
    window.localStorage.setItem(PENDING_REMOVE_KEY, JSON.stringify(remainingRemoves));
  } catch {
    /* ignore */
  }

  // Drain adds.
  const addRaw = window.localStorage.getItem(PENDING_ADD_KEY);
  const toAdd: StoredVlBatch[] = addRaw ? (JSON.parse(addRaw) as StoredVlBatch[]) : [];
  const remainingAdds: StoredVlBatch[] = [];
  for (const b of toAdd) {
    try {
      const { owner: _owner, ...body } = b;
      const res = await fetch("/api/account/vl", {
        method: "POST",
        headers: _buildHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        remainingAdds.push(b);
        break;
      }
    } catch {
      remainingAdds.push(b);
      break;
    }
  }
  try {
    window.localStorage.setItem(PENDING_ADD_KEY, JSON.stringify(remainingAdds));
  } catch {
    /* ignore */
  }
}

// ─── Hydrate from server ──────────────────────────────────────────────────────

/**
 * GET /api/account/state and union server open batches into local cache.
 * Uses vl_batch_id as the dedup key.
 * Server batches that are missing locally are added.
 * Local batches that are not in the server open set are NOT removed
 * (they may be pending confirmation) — except via explicit removeVlBatch.
 *
 * The cross-device cancel win: a batch cancelled on another device will
 * not appear in the server open set, so it won't re-pollute the local cache.
 *
 * Returns the merged local list for the wallet.
 */
export async function hydrateVlBatches(owner: string): Promise<StoredVlBatch[]> {
  if (typeof window === "undefined" || !owner) return getVlBatches(owner);
  try {
    // Drain pending queues first so the server has the latest state.
    await _drainPendingQueues();

    const headers: Record<string, string> = {};
    const token = getSessionToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch("/api/account/state", { headers });
    if (!res.ok) return getVlBatches(owner);

    const data = (await res.json()) as {
      vlBatches: Array<{
        vlBatchId: string;
        owner: string;
        budgetSymbol: string;
        amount: string;
        legs: { symbol: string; price: string }[];
        expiration: number;
        createdAt: number;
      }>;
    };

    if (!Array.isArray(data.vlBatches)) return getVlBatches(owner);

    // Union: server open batches merged with local.
    const local = readAll();
    const serverIds = new Set(data.vlBatches.map((b) => b.vlBatchId));

    // Add server-only batches to local (normalise owner to lowercased session addr).
    for (const sb of data.vlBatches) {
      if (!local.find((l) => l.vlBatchId === sb.vlBatchId)) {
        local.unshift({ ...sb, owner: owner.toLowerCase() });
      }
    }

    // Remove local open batches for this owner that are not in the server open set
    // (they were soft-deleted on another device).
    const filtered = local.filter(
      (l) => l.owner.toLowerCase() !== owner.toLowerCase() || serverIds.has(l.vlBatchId),
    );

    writeAll(filtered);
    return filtered.filter((x) => x.owner.toLowerCase() === owner.toLowerCase());
  } catch {
    return getVlBatches(owner);
  }
}
