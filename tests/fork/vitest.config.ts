import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Fork test vitest config.
 *
 * Deliberately NOT included in the root vitest.config.ts or the component
 * config. These tests spawn anvil, make live RPC + API calls, and take
 * 30–120s. Run explicitly with:
 *
 *   bun run test:fork
 *
 * Environment: node (no DOM, no React).
 * Timeout: 120s per test (anvil fork + live quote latency).
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("../..", import.meta.url)),
    },
  },
  test: {
    name: "fork",
    include: ["tests/fork/**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
    environment: "node",
    testTimeout: 120_000,
    hookTimeout: 60_000,
    reporters: ["verbose"],
  },
});
