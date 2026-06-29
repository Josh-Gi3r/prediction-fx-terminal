/**
 * lib/server/boot.ts
 *
 * Server-side boot assertion.
 *
 * Warns (console.error, not crash) when required server secrets are absent
 * in production. Does NOT throw — local dev still works without secrets;
 * missing secrets only break specific features at runtime.
 *
 * Import this module once in instrumentation.ts (or a server layout) to run
 * on first cold-start:
 *   import "@/lib/server/boot";
 *
 * Or call assertBootSecrets() explicitly at the top of route handlers that
 * need a specific secret.
 */

interface SecretSpec {
  /** Environment variable name. */
  key: string;
  /** Human note on what breaks when absent. */
  note: string;
  /** If true, only warn in production (NODE_ENV === "production"). */
  productionOnly?: boolean;
}

/**
 * Server secrets that should exist in production.
 * Not secret-scanned — these are variable NAMES, not values.
 */
const REQUIRED_SECRETS: SecretSpec[] = [
  {
    key: "POLYMARKET_API_KEY",
    note: "Required for Polymarket builder order attribution (/api/pm/builder-sign).",
    productionOnly: true,
  },
  {
    key: "POLYMARKET_API_SECRET",
    note: "Required for Polymarket builder order attribution.",
    productionOnly: true,
  },
  {
    key: "POLYMARKET_API_PASSPHRASE",
    note: "Required for Polymarket builder order attribution.",
    productionOnly: true,
  },
  {
    key: "PRIVY_APP_SECRET",
    note: "Required when NEXT_PUBLIC_FEATURE_GASLESS_SEND=true (/api/wallet/transfer).",
    productionOnly: true,
  },
  {
    key: "LIFI_API_KEY",
    note: "Optional but recommended in production — LiFi rate-limits keyless requests.",
    productionOnly: true,
  },
];

/**
 * Run at startup. Logs console.error for each missing production secret.
 * Never throws — preserves local dev experience.
 */
export function assertBootSecrets(): void {
  const isProduction = process.env.NODE_ENV === "production";

  for (const spec of REQUIRED_SECRETS) {
    if (spec.productionOnly && !isProduction) continue;
    if (!process.env[spec.key]) {
      console.error(`[boot] MISSING env var ${spec.key} — ${spec.note}`);
    }
  }
}

// Run immediately when this module is imported.
assertBootSecrets();
