import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
      // server-only throws when imported outside a Next.js server context.
      // In vitest (Node runner) we mock it to a no-op so server-side modules
      // can be unit-tested without the Next.js runtime.
      "server-only": fileURLToPath(new URL("tests/__mocks__/server-only.ts", import.meta.url)),
    },
  },
  test: {
    include: ["{lib,app}/**/*.test.ts"],
    exclude: [".next/**", "node_modules/**"],
    environment: "node",
  },
});
