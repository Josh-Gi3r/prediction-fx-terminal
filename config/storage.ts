/**
 * config/storage.ts
 *
 * localStorage key namespace for this app.
 * Change APP_STORAGE_NS to avoid collisions between different deployments.
 * All localStorage keys across the app use this namespace prefix.
 *
 * Default: "predfx" — set NEXT_PUBLIC_STORAGE_NS in your env to override.
 */
export const APP_STORAGE_NS =
  process.env.NEXT_PUBLIC_STORAGE_NS ?? "predfx";
