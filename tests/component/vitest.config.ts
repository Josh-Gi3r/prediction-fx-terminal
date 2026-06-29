import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/**
 * Separate vitest config for component tests.
 * Uses jsdom environment + React plugin for JSX transform.
 * The root vitest.config.ts stays node-env and is untouched.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("../..", import.meta.url)),
    },
  },
  test: {
    name: "component",
    include: ["tests/component/**/*.test.tsx", "tests/component/**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
    environment: "jsdom",
    globals: true,
    setupFiles: ["tests/component/setup.ts"],
  },
});
