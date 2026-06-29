/**
 * tests/__mocks__/server-only.ts
 *
 * Stub for the `server-only` package used in unit tests (vitest/Node runner).
 * Next.js's `server-only` package throws when imported outside its server
 * context; this no-op stub allows server-side modules to be imported and
 * tested in vitest without the Next.js runtime.
 *
 * Aliased via vitest.config.ts resolve.alias — production builds are
 * unaffected (the alias only applies to vitest).
 */

// Intentionally empty — the package has no exports.
export {};
