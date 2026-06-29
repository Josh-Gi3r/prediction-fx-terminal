/**
 * lib/account/activityLog.ts
 *
 * Client-side append-only action log. PUBLIC metadata only -- tx hash, type,
 * amount, token, chain, timestamp. NO keys, secrets, or wallet data.
 *
 * Capped at MAX_ENTRIES so it never grows unbounded.
 * Keyed per wallet address so each account has its own history.
 */

export type ActionType =
  | "swap"
  | "bridge"
  | "send"
  | "bet"
  | "p2p_buy"
  | "p2p_sell"
  | "earn_deposit"
  | "earn_withdraw";

export interface ActivityEntry {
  id: string;
  type: ActionType;
  /** Unix milliseconds */
  timestamp: number;
  /** Human-readable amount (e.g. "100.00") */
  amount: string;
  /** Token symbol (e.g. "USDC") */
  token: string;
  /** Output token symbol, for swaps */
  toToken?: string;
  /** Human-readable output amount, for swaps */
  toAmount?: string;
  /** Chain id where the tx happened */
  chainId: number;
  /** On-chain tx hash */
  txHash?: string;
  /** Extra label (e.g. market title for bets) */
  label?: string;
}

const MAX_ENTRIES = 200;

function key(owner: string): string {
  return `${process.env.NEXT_PUBLIC_STORAGE_NS ?? "predfx"}.activity.${owner.toLowerCase()}`;
}

function readLog(owner: string): ActivityEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key(owner));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ActivityEntry[]) : [];
  } catch {
    return [];
  }
}

function writeLog(owner: string, entries: ActivityEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key(owner), JSON.stringify(entries));
  } catch {
    // storage full or denied — ignore
  }
}

/**
 * Append an activity entry for a wallet address.
 * Silently enforces MAX_ENTRIES cap (oldest entries dropped).
 * Safe to call from any success callback — never throws.
 */
export function logAction(owner: string, entry: Omit<ActivityEntry, "id" | "timestamp">): void {
  if (!owner) return;
  try {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const full: ActivityEntry = { ...entry, id, timestamp: Date.now() };
    const existing = readLog(owner);
    const next = [full, ...existing].slice(0, MAX_ENTRIES);
    writeLog(owner, next);
  } catch {
    // never throw from a logging helper
  }
}

/**
 * Return all entries for an address, newest first.
 */
export function getActivityLog(owner: string): ActivityEntry[] {
  if (!owner) return [];
  return readLog(owner);
}

/**
 * Clear the log for an address.
 */
export function clearActivityLog(owner: string): void {
  if (typeof window === "undefined" || !owner) return;
  try {
    window.localStorage.removeItem(key(owner));
  } catch {
    // ignore
  }
}
