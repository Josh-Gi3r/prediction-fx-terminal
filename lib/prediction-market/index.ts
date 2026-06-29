/**
 * lib/prediction-market/index.ts
 *
 * Exports the active prediction market adapter.
 *
 * Default: Polymarket CLOB (lib/polymarket/).
 * Feature flag: NEXT_PUBLIC_FEATURE_PM_BETTING=true to enable live order placement.
 *
 * Server credentials (server-only, never NEXT_PUBLIC_):
 *   POLYMARKET_API_KEY
 *   POLYMARKET_API_SECRET
 *   POLYMARKET_API_PASSPHRASE
 */

export type { PredictionMarketAdapter, PredictionMarket, PredictionMarketPosition } from "./adapter";

