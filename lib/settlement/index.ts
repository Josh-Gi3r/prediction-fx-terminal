/**
 * lib/settlement/index.ts
 *
 * Exports the active settlement provider adapter.
 *
 * Default: FX provider CLOB (lib/fx-provider/).
 *
 * To switch providers:
 *   1. Implement SettlementAdapter (see ./adapter.ts).
 *   2. Replace the import below with your own adapter module.
 *   3. Make sure your adapter's env vars are documented in .env.example.
 *
 * The FX provider adapter reads:
 *   NEXT_PUBLIC_FX_PROVIDER_API_BASE  (client-safe)
 *   FX_PROVIDER_API                   (server alias)
 *   FX_PROVIDER_API_KEY / FX_PROVIDER_API_SECRET  (server-only, optional)
 */

// Re-export the FX provider implementation as the default adapter.
// The original FX provider client is preserved in lib/fx-provider/ and continues to work.
export type { SettlementAdapter, SettlementQuote, SettlementQuoteParams } from "./adapter";

// The concrete FX provider adapter is in lib/fx-provider/server-client.ts.
// Re-export the high-level client for convenience so callers can do:
//   import { fxClient } from "@/lib/settlement"
export { fxClient } from "@/lib/fx-provider/server-client";
export { getFxProviderBaseUrl as getSettlementBaseUrl } from "@/lib/fx-provider/config";
