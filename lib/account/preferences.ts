/**
 * lib/account/preferences.ts
 *
 * Typed user preferences stored in localStorage. Public metadata only;
 * no keys, secrets, or wallet data. All writes are idempotent.
 *
 * Prefs that are LIVE-WIRED:
 *   - slippage: read by SwapCard via useSwapPrefs() below.
 *
 * Prefs that are STORED-ONLY (ready when delivery is built):
 *   - settlementStablecoin
 *   - defaultChain
 *   - oddsFormat
 *   - notifications.*
 *
 * Server sync:
 *   - writePrefs: optimistic localStorage write + best-effort PUT /api/account/prefs.
 *     On failure, enqueues in a pendingSync queue (also localStorage) for retry.
 *   - hydratePrefs(): GETs /api/account/state and merges server prefs into local cache
 *     (server wins for scalar fields, client wins only when server has no data).
 *     Server prefs take authority; call after login.
 */

const PREFS_KEY = `${process.env.NEXT_PUBLIC_STORAGE_NS ?? "predfx"}.account.prefs.v1`;
const PENDING_SYNC_KEY = `${process.env.NEXT_PUBLIC_STORAGE_NS ?? "predfx"}.account.prefs.pendingSync.v1`;

// ─── Types ────────────────────────────────────────────────────────────────────

export type SlippageBps = 10 | 50 | 100; // 0.1% / 0.5% / 1.0%

export interface NotificationPrefs {
  betFilled: boolean;
  orderFilled: boolean;
  marketResolves: boolean;
  p2p: boolean;
}

export interface AccountPrefs {
  /** Swap slippage tolerance. 0.5% default. */
  slippageBps: SlippageBps | number;
  /** Custom slippage string (e.g. "0.75") when not one of the presets. */
  slippageCustom: string | null;
  /**
   * Preferred settlement stablecoin symbol.
   * Stored-only; delivery TBD.
   */
  settlementStablecoin: string;
  /**
   * Default chain id.
   * Stored-only; delivery TBD.
   */
  defaultChain: number;
  /**
   * Prediction market odds format.
   * Stored-only; delivery TBD.
   */
  oddsFormat: "cents" | "percent" | "american";
  /** Notification toggles. Stored-only; delivery TBD. */
  notifications: NotificationPrefs;
}

export const DEFAULT_PREFS: AccountPrefs = {
  slippageBps: 50,
  slippageCustom: null,
  settlementStablecoin: "USDC",
  defaultChain: 1,
  oddsFormat: "cents",
  notifications: {
    betFilled: true,
    orderFilled: true,
    marketResolves: true,
    p2p: true,
  },
};

// ─── Read / write ─────────────────────────────────────────────────────────────

export function readPrefs(): AccountPrefs {
  if (typeof window === "undefined") return { ...DEFAULT_PREFS };
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw) as Partial<AccountPrefs>;
    // Deep merge so missing keys get defaults even after we add new fields.
    return {
      ...DEFAULT_PREFS,
      ...parsed,
      notifications: {
        ...DEFAULT_PREFS.notifications,
        ...(parsed.notifications ?? {}),
      },
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function writePrefs(patch: Partial<AccountPrefs>): AccountPrefs {
  const current = readPrefs();
  const next: AccountPrefs = {
    ...current,
    ...patch,
    notifications: {
      ...current.notifications,
      ...(patch.notifications ?? {}),
    },
  };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    } catch {
      // storage full or denied — ignore
    }
  }

  // Best-effort server sync (fire and forget — never throws).
  _syncPrefsToServer(patch).catch(() => {
    // already handled inside
  });

  return next;
}

export function resetPrefs(): AccountPrefs {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(PREFS_KEY);
    } catch {
      // ignore
    }
  }
  return { ...DEFAULT_PREFS };
}

/**
 * Returns slippage as a decimal (0.005 for 50 bps) suitable for passing
 * to aggregator quote params. Reads live from localStorage each call.
 */
export function getSlippageDecimal(): number {
  const prefs = readPrefs();
  return prefs.slippageBps / 10_000;
}

// ─── Server sync ──────────────────────────────────────────────────────────────

/**
 * PUT /api/account/prefs best-effort.
 * On failure: enqueues patch in pendingSync localStorage queue, never throws.
 * Includes Bearer token if one is available via getSessionToken().
 */
async function _syncPrefsToServer(patch: Partial<AccountPrefs>): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const token = getSessionToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch("/api/account/prefs", {
      method: "PUT",
      headers,
      body: JSON.stringify(patch),
    });

    if (res.ok) {
      // Successful sync — flush any pending items for this patch key.
      _flushPendingSyncQueue();
      return;
    }

    // Non-ok (e.g. 401 no session yet) — enqueue for retry.
    _enqueuePendingSync(patch);
  } catch {
    // Network error — enqueue for retry.
    _enqueuePendingSync(patch);
  }
}

// ─── Pending sync queue ───────────────────────────────────────────────────────

interface PendingEntry {
  patch: Partial<AccountPrefs>;
  enqueuedAt: number;
}

function _readPendingQueue(): PendingEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PENDING_SYNC_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PendingEntry[]) : [];
  } catch {
    return [];
  }
}

function _writePendingQueue(entries: PendingEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    // Cap queue at 20 entries; drop oldest if exceeded.
    const capped = entries.slice(-20);
    window.localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(capped));
  } catch {
    // ignore
  }
}

function _enqueuePendingSync(patch: Partial<AccountPrefs>): void {
  const queue = _readPendingQueue();
  queue.push({ patch, enqueuedAt: Date.now() });
  _writePendingQueue(queue);
}

function _flushPendingSyncQueue(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PENDING_SYNC_KEY);
  } catch {
    // ignore
  }
}

/**
 * Drain the pending sync queue — attempts to replay each queued patch
 * in order. Stops on first failure to preserve ordering.
 * Called by hydratePrefs after a successful server hydration.
 */
export async function drainPendingPrefsSync(): Promise<void> {
  if (typeof window === "undefined") return;
  const queue = _readPendingQueue();
  if (queue.length === 0) return;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getSessionToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const remaining: PendingEntry[] = [];
  for (const entry of queue) {
    try {
      const res = await fetch("/api/account/prefs", {
        method: "PUT",
        headers,
        body: JSON.stringify(entry.patch),
      });
      if (!res.ok) {
        remaining.push(entry);
        break; // stop on first failure
      }
    } catch {
      remaining.push(entry);
      break;
    }
  }
  _writePendingQueue(remaining);
}

// ─── Hydrate from server ──────────────────────────────────────────────────────

/**
 * GET /api/account/state and merge server prefs into local cache.
 * Server prefs are authoritative; they overwrite local values.
 * Silently no-ops if not authenticated or on network error.
 *
 * Returns the final merged prefs.
 */
export async function hydratePrefs(): Promise<AccountPrefs> {
  if (typeof window === "undefined") return readPrefs();
  try {
    const headers: Record<string, string> = {};
    const token = getSessionToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch("/api/account/state", { headers });
    if (!res.ok) return readPrefs();

    const data = (await res.json()) as { prefs: Partial<AccountPrefs> | null };
    if (!data.prefs) return readPrefs();

    // Server wins: deep-merge server prefs on top of local defaults.
    const serverPrefs = data.prefs;
    const merged: AccountPrefs = {
      ...DEFAULT_PREFS,
      ...readPrefs(), // local first
      ...serverPrefs, // server overrides
      notifications: {
        ...DEFAULT_PREFS.notifications,
        ...(readPrefs().notifications ?? {}),
        ...(serverPrefs.notifications ?? {}),
      },
    };

    // Persist merged result locally.
    try {
      window.localStorage.setItem(PREFS_KEY, JSON.stringify(merged));
    } catch {
      // ignore
    }

    // Drain any queued patches now that we have a session.
    await drainPendingPrefsSync();

    return merged;
  } catch {
    return readPrefs();
  }
}

// ─── Session token accessor ───────────────────────────────────────────────────

/** In-memory session token (set by useAccountSync after login). */
let _sessionToken: string | null = null;

export function getSessionToken(): string | null {
  return _sessionToken;
}

export function setSessionToken(token: string | null): void {
  _sessionToken = token;
}
