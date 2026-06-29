/**
 * lib/fx-provider/config.ts
 *
 * Single FX Provider API base URL resolver.
 *
 * Previously the base URL default was copy-pasted in 4 places.
 * Resolution order (back-compat — both env names remain supported):
 *   1. NEXT_PUBLIC_FX_PROVIDER_API_BASE  (client-safe, works in both browser + server)
 *   2. FX_PROVIDER_API                   (server-only alias)
 *   3. Hardcoded default                 "https://api.your-fx-provider.example.com/api/v1"
 *      Replace this with your actual FX settlement provider base URL.
 *
 * SAFE to import from both client ("use client") and server code.
 */

const FX_PROVIDER_DEFAULT = "https://api.your-fx-provider.example.com/api/v1";

/**
 * Returns the FX Provider REST API base URL, with a trailing slash stripped.
 * Reads env at call time so tests can override process.env mid-run.
 */
export function getFxProviderBaseUrl(): string {
  if (typeof process !== "undefined") {
    const url =
      process.env.NEXT_PUBLIC_FX_PROVIDER_API_BASE ??
      process.env.FX_PROVIDER_API ??
      FX_PROVIDER_DEFAULT;
    return url.replace(/\/$/, "");
  }
  return FX_PROVIDER_DEFAULT;
}
