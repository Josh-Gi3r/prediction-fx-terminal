"use client";

/**
 * lib/account/useAccountSync.ts
 *
 * SIWE login + cross-device sync hook.
 *
 * Design:
 *   - LAZY — ensureSynced() is called by UI when the user opens Settings
 *     or submits a VL batch. NEVER on app load. Falling back to pure
 *     localStorage is always valid.
 *   - NEVER force — if the user declines the sign request, everything
 *     keeps working from localStorage (current behavior).
 *   - Bearer token stored in memory only (never localStorage/cookie).
 *     The __Host-sid cookie is set by the server on login response and
 *     handles all subsequent browser requests automatically.
 *   - First-sync migration: on the first ensureSynced for a given address,
 *     push local-only prefs + open VL batches to the server before hydrating.
 *
 * Usage:
 *   const { ensureSynced, isSyncing } = useAccountSync();
 *   // In a click handler:
 *   await ensureSynced();   // signs in if needed, then hydrates
 *
 * ACTIVITY IS NOT SYNCED — activityLog.ts stays purely localStorage (privacy).
 */

import {
  drainPendingPrefsSync,
  getSessionToken,
  hydratePrefs,
  readPrefs,
  setSessionToken,
  writePrefs,
} from "@/lib/account/preferences";
import { buildSiweMessage } from "@/lib/account/siwe";
import { addVlBatch, getVlBatches, hydrateVlBatches } from "@/lib/desks/vlStore";
import { useCallback, useRef, useState } from "react";
import { useAccount, useSignMessage } from "wagmi";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AccountSyncResult {
  /**
   * Ensure the user is logged in and prefs/VL batches are hydrated from the server.
   * Returns true on success, false if the user declined signing or any step failed.
   * Never throws.
   */
  ensureSynced: () => Promise<boolean>;
  /** True while a login or hydration is in flight. */
  isSyncing: boolean;
  /** The authenticated address, or null if not synced. */
  syncedAddress: string | null;
}

// ─── First-sync flag helpers ──────────────────────────────────────────────────

function hasSyncedFlag(address: string): boolean {
  if (typeof window === "undefined") return false;
  return !!window.localStorage.getItem(`${process.env.NEXT_PUBLIC_STORAGE_NS ?? "predfx"}.synced.${address.toLowerCase()}`);
}

function setSyncedFlag(address: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${process.env.NEXT_PUBLIC_STORAGE_NS ?? "predfx"}.synced.${address.toLowerCase()}`, "1");
  } catch {
    /* ignore */
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAccountSync(): AccountSyncResult {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncedAddress, setSyncedAddress] = useState<string | null>(null);

  // Guard against concurrent calls (e.g. rapid double-click).
  const inFlight = useRef(false);

  const ensureSynced = useCallback(async (): Promise<boolean> => {
    if (inFlight.current) return false;
    if (!address) return false;

    const lcAddress = address.toLowerCase();

    // Already synced in this session?
    if (syncedAddress === lcAddress && getSessionToken()) {
      return true;
    }

    inFlight.current = true;
    setIsSyncing(true);

    try {
      // ── Step 1: check if we already have a valid server session (cookie path).
      // A quick GET /api/account/state with no Bearer token will succeed if the
      // __Host-sid cookie is still valid.
      const probeRes = await fetch("/api/account/state");
      if (probeRes.ok) {
        // Cookie session still alive — no re-login needed.
        await _doHydrate(lcAddress);
        setSyncedAddress(lcAddress);
        return true;
      }

      // ── Step 2: SIWE login flow.
      let nonceRes: Response;
      try {
        nonceRes = await fetch("/api/account/nonce");
        if (!nonceRes.ok) return false;
      } catch {
        return false;
      }

      const { nonce } = (await nonceRes.json()) as { nonce: string };

      // Build the SIWE message client-side (same format as server's buildSiweMessage).
      const domain = typeof window !== "undefined" ? window.location.host : (new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://your-app.example.com")).host;
      const message = buildSiweMessage(address, nonce, domain);

      // Request wallet signature — user may decline.
      let signature: string;
      try {
        signature = await signMessageAsync({ message });
      } catch {
        // User declined or wallet error — fall back to localStorage.
        return false;
      }

      // ── Step 3: POST /api/account/login.
      let loginRes: Response;
      try {
        loginRes = await fetch("/api/account/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message, signature }),
        });
        if (!loginRes.ok) return false;
      } catch {
        return false;
      }

      const { token } = (await loginRes.json()) as { address: string; token: string };
      // Store bearer token in memory for Telegram WebView and explicit fetch calls.
      setSessionToken(token);

      // ── Step 4: First-sync migration.
      if (!hasSyncedFlag(lcAddress)) {
        await _pushLocalDataToServer(lcAddress, token);
        setSyncedFlag(lcAddress);
      }

      // ── Step 5: Hydrate from server (server-authoritative merge).
      await _doHydrate(lcAddress);

      setSyncedAddress(lcAddress);
      return true;
    } catch {
      return false;
    } finally {
      inFlight.current = false;
      setIsSyncing(false);
    }
  }, [address, syncedAddress, signMessageAsync]);

  return { ensureSynced, isSyncing, syncedAddress };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function _doHydrate(address: string): Promise<void> {
  try {
    await Promise.all([hydratePrefs(), hydrateVlBatches(address)]);
  } catch {
    // hydrate functions are already never-throw, this is belt-and-suspenders
  }
}

/**
 * First-sync migration: push any local-only prefs + open VL batches to the
 * server before hydrating. This ensures existing users don't lose data when
 * they log in for the first time.
 */
async function _pushLocalDataToServer(address: string, token: string): Promise<void> {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  // Push local prefs (idempotent PUT).
  try {
    const localPrefs = readPrefs();
    await fetch("/api/account/prefs", {
      method: "PUT",
      headers,
      body: JSON.stringify(localPrefs),
    });
  } catch {
    // non-fatal
  }

  // Push local open VL batches (idempotent POST per batch).
  try {
    const localBatches = getVlBatches(address);
    await Promise.allSettled(
      localBatches.map(({ owner: _owner, ...body }) =>
        fetch("/api/account/vl", {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        }),
      ),
    );
  } catch {
    // non-fatal
  }

  // Drain any pending sync queues.
  try {
    await drainPendingPrefsSync();
  } catch {
    // non-fatal
  }
}
