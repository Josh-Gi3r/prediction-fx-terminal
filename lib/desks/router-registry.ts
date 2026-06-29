/**
 * lib/desks/router-registry.ts
 *
 * Pluggable DEX router registry.
 *
 * The default build includes three routers: LiFi, Kyber, and CoW.
 * Add or remove routers by editing REGISTERED_ROUTERS below.
 * The quote fanout in /api/quotes iterates this registry.
 *
 * Each router's server-side quote function must conform to:
 *   (params: QuoteParams) => Promise<QuoteResult>
 *
 * Router-specific env vars:
 *   NEXT_PUBLIC_LIFI_INTEGRATOR  — LiFi app attribution ID
 *   LIFI_API_KEY                 — optional, reduces rate-limit risk
 *
 * To add a new router:
 *   1. Implement a server-side quote function in lib/server/quotes/<name>.ts.
 *   2. Add an entry to REGISTERED_ROUTERS with a unique source key.
 *   3. Add an executor in lib/desks/executors/<name>.ts.
 *   4. The /api/quotes route picks it up automatically from the registry.
 *
 * To disable a router: remove its entry from REGISTERED_ROUTERS.
 */

import type { QuoteParams, QuoteResult } from "./source";

export interface RouterEntry {
  /** Unique identifier used in QuoteResult.source and the UI. */
  source: string;
  /** Human-readable display name. */
  name: string;
  /**
   * Server-side quote function.
   * Lazy-imported to avoid bundling server deps into client components.
   * Returns null if not configured / feature-disabled.
   */
  serverQuote: ((params: QuoteParams) => Promise<QuoteResult>) | null;
}

/**
 * Registered DEX routers — edit this array to add/remove/reorder.
 * The first entry that returns an ok quote is eligible to be ranked "best"
 * by the quoteEconomics.selectBest function (CoW is ranking-excluded by default).
 */
export const REGISTERED_ROUTERS: RouterEntry[] = [
  {
    source: "lifi",
    name: "LiFi",
    // Loaded server-side in /api/quotes — safe, not bundled to client.
    serverQuote: null, // populated at runtime by /api/quotes/route.ts
  },
  {
    source: "kyber",
    name: "KyberSwap",
    serverQuote: null,
  },
  {
    source: "cow",
    name: "CoW Protocol",
    serverQuote: null,
  },
];

/** Source key → entry lookup. */
export function getRouter(source: string): RouterEntry | undefined {
  return REGISTERED_ROUTERS.find((r) => r.source === source);
}

/** All registered source keys. */
export const ROUTER_SOURCES = REGISTERED_ROUTERS.map((r) => r.source);
