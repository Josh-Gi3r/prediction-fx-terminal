import "server-only";

/**
 * Boot-time check that production-required server secrets are present.
 *
 * Warns (does NOT crash) so local dev and preview deploys without every
 * integration key still boot. In production a missing key here means a money
 * path is silently broken (swap settlement, betting attribution, gasless send),
 * which prior audits flagged as a recurring "works in dev, dead in prod" class.
 *
 * Called once from instrumentation/register so it runs at server start.
 */
const REQUIRED_IN_PROD: Array<{ name: string; breaks: string }> = [
  { name: "FX_PROVIDER_API_KEY", breaks: "FX provider swap settlement confirmation + in-app deposit" },
  { name: "FX_PROVIDER_API_SECRET", breaks: "FX provider swap settlement confirmation + in-app deposit" },
  { name: "LIFI_API_KEY", breaks: "LiFi swap + bridge quotes" },
  { name: "PRIVY_APP_SECRET", breaks: "gasless Send (Privy wallet transfer)" },
  { name: "POLYMARKET_API_KEY", breaks: "Polymarket builder attribution" },
  { name: "POLYMARKET_API_SECRET", breaks: "Polymarket builder attribution" },
  { name: "POLYMARKET_API_PASSPHRASE", breaks: "Polymarket builder attribution" },
  {
    name: "SESSION_JWT_SECRET",
    breaks: "account session (SIWE login, prefs sync) — all /api/account/* routes dead",
  },
];

let checked = false;

export function checkRequiredEnv(): void {
  if (checked) return;
  checked = true;
  if (process.env.NODE_ENV !== "production") return;
  const missing = REQUIRED_IN_PROD.filter((v) => !process.env[v.name]);
  if (missing.length === 0) return;
  // Loud, single, structured warning — visible in Railway logs at boot.
  const detail = missing.map((m) => `${m.name} -> breaks: ${m.breaks}`).join(" | ");
  console.error(`[boot] MISSING REQUIRED PROD ENV (${missing.length}): ${detail}`);
}
