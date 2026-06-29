const LEGACY_PREFIX = "app.apikey."; // legacy namespace — keep for purge compatibility

/**
 * Removes any localStorage entries that were written by the old `useApiKey`
 * localStorage-persistence layer (prefix `app.apikey.`). Safe to call on
 * every app boot — idempotent, no-op in SSR, swallows storage errors.
 */
export function purgeLegacyApiKeys(): void {
  if (typeof window === "undefined") return;
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(LEGACY_PREFIX)) {
        toRemove.push(key);
      }
    }
    for (const key of toRemove) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Storage may be unavailable (e.g. private browsing, quota exceeded).
    // Fail silently — this is a best-effort cleanup.
  }
}
