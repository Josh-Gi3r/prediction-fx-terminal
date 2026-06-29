/**
 * Local tracking for Peer intents/deposits this browser created — the same
 * pattern as lib/desks/vlStore. The chain + indexer are the source of truth;
 * this is just "what did I start here" so /cash and /portfolio can resume the
 * pay → prove → fulfill lifecycle after a reload.
 */

import type { PeerIntentStatus } from "./config";

export interface TrackedPeerIntent {
  intentHash: string;
  owner: string;
  side: "buy" | "sell";
  platform: string;
  fiatCurrency: string;
  fiatAmount: string;
  usdcAmount: string;
  status: PeerIntentStatus;
  createdAt: number;
  updatedAt: number;
  txHash?: string;
}

export interface TrackedPeerDeposit {
  depositId: string;
  owner: string;
  platforms: string[];
  usdcAmount: string;
  status: "active" | "paused" | "withdrawn";
  createdAt: number;
}

const KEY = (owner: string) => `${process.env.NEXT_PUBLIC_STORAGE_NS ?? "predfx"}.peer.${owner.toLowerCase()}`;

interface Bag {
  intents: TrackedPeerIntent[];
  deposits: TrackedPeerDeposit[];
}

function read(owner: string): Bag {
  if (typeof window === "undefined") return { intents: [], deposits: [] };
  try {
    const raw = window.localStorage.getItem(KEY(owner));
    if (!raw) return { intents: [], deposits: [] };
    const parsed = JSON.parse(raw) as Partial<Bag>;
    return { intents: parsed.intents ?? [], deposits: parsed.deposits ?? [] };
  } catch {
    return { intents: [], deposits: [] };
  }
}

function write(owner: string, bag: Bag): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY(owner), JSON.stringify(bag));
}

export function listPeerIntents(owner: string): TrackedPeerIntent[] {
  return read(owner).intents.sort((a, b) => b.createdAt - a.createdAt);
}

export function listPeerDeposits(owner: string): TrackedPeerDeposit[] {
  return read(owner).deposits.sort((a, b) => b.createdAt - a.createdAt);
}

export function trackPeerIntent(owner: string, intent: TrackedPeerIntent): void {
  const bag = read(owner);
  bag.intents = [intent, ...bag.intents.filter((i) => i.intentHash !== intent.intentHash)];
  write(owner, bag);
}

export function updatePeerIntent(
  owner: string,
  intentHash: string,
  patch: Partial<TrackedPeerIntent>,
): void {
  const bag = read(owner);
  bag.intents = bag.intents.map((i) =>
    i.intentHash === intentHash ? { ...i, ...patch, updatedAt: Date.now() } : i,
  );
  write(owner, bag);
}

export function trackPeerDeposit(owner: string, deposit: TrackedPeerDeposit): void {
  const bag = read(owner);
  bag.deposits = [deposit, ...bag.deposits.filter((d) => d.depositId !== deposit.depositId)];
  write(owner, bag);
}

export function updatePeerDeposit(
  owner: string,
  depositId: string,
  patch: Partial<TrackedPeerDeposit>,
): void {
  const bag = read(owner);
  bag.deposits = bag.deposits.map((d) => (d.depositId === depositId ? { ...d, ...patch } : d));
  write(owner, bag);
}
