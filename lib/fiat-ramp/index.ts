/**
 * lib/fiat-ramp/index.ts
 *
 * Exports the active fiat ramp adapter.
 *
 * Default: zkP2P protocol (lib/peer/).
 * Feature flag: NEXT_PUBLIC_FEATURE_PEER=true to enable the /cash surface.
 *
 * The zkP2P adapter config lives in lib/peer/config.ts.
 * The zkP2P API client lives in lib/peer/client.ts.
 * The zkP2P vaults and quote hooks live in lib/peer/*.ts.
 */

export type { FiatRampAdapter, FiatRampQuote } from "./adapter";

// Re-export zkP2P config constants for convenience.
export {
  PEER_ENABLED,
  PEER_BASE_API_URL,
  PEER_PAYMENT_PLATFORMS,
  PEER_FIAT_CURRENCIES,
  referrerFeeConfig,
} from "@/lib/peer/config";
