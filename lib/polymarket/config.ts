/**
 * ─── Polymarket shared config ─────────────────────────────────────────────────
 *
 * Feature flags + constants for the PM betting surface.
 * SAFE for client import — no secrets, no server-only deps.
 *
 * Betting is disabled by default until EIP-712 domain, FILL_ADDRESS
 * substitution, and USDC approve are verified correct in production.
 */

/**
 * Feature flag. OFF by default — markets are view-only; real order placement
 * is gated until settlement wiring is confirmed correct end-to-end.
 */
export const PM_BETTING_ENABLED = process.env.NEXT_PUBLIC_FEATURE_PM_BETTING === "true";
