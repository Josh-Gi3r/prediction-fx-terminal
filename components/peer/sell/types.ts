/**
 * components/peer/sell/types.ts
 *
 * Shared types and factories for the SellPanel module.
 */

import type { PeerFiatCurrency, PeerPaymentPlatform } from "@/lib/peer/config";
import { PEER_FIAT_CURRENCIES } from "@/lib/peer/config";

// ─── per-platform entry ───────────────────────────────────────────────────────

export interface PlatformEntry {
  id: string; // stable local key
  platform: PeerPaymentPlatform;
  offchainId: string;
  currencies: PeerFiatCurrency[];
  // per-currency rates: key = currency code, value = rate string
  rates: Record<string, string>;
  expanded: boolean;
}

export function newPlatformEntry(platform: PeerPaymentPlatform): PlatformEntry {
  const defaultCurrency = PEER_FIAT_CURRENCIES.find((f) => f.code === platform.currencies[0]);
  return {
    id: `${platform.key}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    platform,
    offchainId: "",
    currencies: defaultCurrency ? [defaultCurrency] : [],
    rates: {},
    expanded: true,
  };
}

// ─── advanced settings ────────────────────────────────────────────────────────

export interface AdvancedSettings {
  // Private orderbook gate. The Peer protocol enforces a private orderbook via a
  // single on-chain whitelist-hook *contract* (set with setDepositWhitelistHook),
  // not a raw list of taker wallets — so we collect the deployed hook address and
  // submit it for real after the deposit is created.
  whitelistEnabled: boolean;
  whitelistHook: string;
  delegateEnabled: boolean;
  selectedVaultId: string | null;
  delegateTab: "volume" | "apr";
  minOrder: string;
  maxOrder: string;
  retainOnEmpty: boolean;
}
