/**
 * App smoke suite — ported from functional-audit.spec.ts.
 *
 * Covers:
 * 1. 21-route render smoke: every page returns HTTP 200 and has > 200 chars of
 *    body text with no Next.js runtime-error overlay.
 * 2. Mutator GET→405 probes: POST-only routes must reject GET (Next.js App Router
 *    returns 405 when no GET export exists).
 * 3. Public API JSON shape checks: GET endpoints must return 200 JSON with
 *    expected top-level keys.
 *
 * Target: < 2 min wall time. No wallet interaction (needs browser signing).
 * webServer: bun run start -- -p 3199 (requires prior `bun run build`).
 */

import { expect, test } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3199";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FRAMEWORK_ERROR_RE =
  /Unhandled Runtime Error|Application error|Next\.js|Hydration failed|Build Error|Runtime Error/i;

// ─── 1. Route smoke ───────────────────────────────────────────────────────────

const SMOKE_ROUTES = [
  "/",
  "/swap",
  "/markets",
  "/earn",
  "/cash",
  "/portfolio",
  "/router",
  "/trade",
  "/trade/pro",
  "/wc",
  "/wc/groups",
  "/wc/matches",
  "/wc/bracket",
  "/wc/boot",
  "/wc/props",
  "/wc/match/1",
  "/legal/terms",
  "/legal/privacy",
  "/mobile",
];

test.describe("route smoke — 21 pages render without errors", () => {
  // Dynamically resolve vault and WC market routes before testing them.
  let earnVaultRoute = "/earn/vaults/unknown";
  let wcMarketRoute = "/wc/m/wc";

  test.beforeAll(async ({ request }) => {
    const vaultRes = await request.get(`${BASE}/api/p2p/vaults`).catch(() => null);
    if (vaultRes?.ok()) {
      const json = await vaultRes.json().catch(() => ({}));
      const firstId = json?.vaults?.[0]?.id;
      if (firstId) earnVaultRoute = `/earn/vaults/${encodeURIComponent(firstId)}`;
    }

    const marketRes = await request.get(`${BASE}/api/wc/markets`).catch(() => null);
    if (marketRes?.ok()) {
      const json = await marketRes.json().catch(() => ({}));
      const firstKey = json?.markets?.[0]?.key;
      if (firstKey) wcMarketRoute = `/wc/m/${encodeURIComponent(firstKey)}`;
    }
  });

  for (const route of SMOKE_ROUTES) {
    test(`GET ${route} → 200, meaningful content, no framework overlay`, async ({ page }) => {
      const response = await page.goto(`${BASE}${route}`, {
        waitUntil: "domcontentloaded",
        timeout: 25_000,
      });
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});

      // HTTP layer
      expect(response?.status() ?? 0, `${route} should return 200`).toBe(200);

      // Body text > 200 chars (not a blank/skeleton-only page)
      const bodyText = await page
        .locator("body")
        .innerText({ timeout: 3_000 })
        .catch(() => "");
      expect(bodyText.trim().length, `${route} body has < 200 chars of text`).toBeGreaterThan(200);

      // No Next.js runtime error overlay
      const hasOverlay = FRAMEWORK_ERROR_RE.test(bodyText);
      expect(hasOverlay, `${route} has a framework error overlay`).toBe(false);
    });
  }

  test("GET /earn/vaults/:id → 200, meaningful content", async ({ page }) => {
    const response = await page.goto(`${BASE}${earnVaultRoute}`, {
      waitUntil: "domcontentloaded",
      timeout: 25_000,
    });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    expect(response?.status() ?? 0).toBe(200);
    const bodyText = await page
      .locator("body")
      .innerText({ timeout: 3_000 })
      .catch(() => "");
    expect(bodyText.trim().length).toBeGreaterThan(200);
    expect(FRAMEWORK_ERROR_RE.test(bodyText)).toBe(false);
  });

  test("GET /wc/m/:key → 200, meaningful content", async ({ page }) => {
    const response = await page.goto(`${BASE}${wcMarketRoute}`, {
      waitUntil: "domcontentloaded",
      timeout: 25_000,
    });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    expect(response?.status() ?? 0).toBe(200);
    const bodyText = await page
      .locator("body")
      .innerText({ timeout: 3_000 })
      .catch(() => "");
    expect(bodyText.trim().length).toBeGreaterThan(200);
    expect(FRAMEWORK_ERROR_RE.test(bodyText)).toBe(false);
  });
});

// ─── 2. Mutator GET→405 probes ────────────────────────────────────────────────

const POST_ONLY_ROUTES = [
  "/api/swap",
  "/api/scan",
  "/api/vl/batch",
  "/api/vl/cancel",
  "/api/fx-deposit",
];

test.describe("POST-only routes reject GET with 405", () => {
  for (const ep of POST_ONLY_ROUTES) {
    test(`GET ${ep} → 405`, async ({ request }) => {
      const res = await request.get(`${BASE}${ep}`);
      expect(res.status(), `${ep} should reject GET with 405`).toBe(405);
    });
  }
});

// ─── 3. Public API JSON shape checks ─────────────────────────────────────────

const PUBLIC_API_CHECKS: Array<{ path: string; keys: string[] }> = [
  { path: "/api/config", keys: ["chain_id", "settlement_address"] },
  { path: "/api/tokens", keys: ["tokens"] },
  { path: "/api/yields", keys: [] }, // shape may vary; just assert valid JSON + 200
  { path: "/api/wc/markets", keys: ["markets"] },
  { path: "/api/fx-markets", keys: [] },
  { path: "/api/perp-vaults", keys: [] },
];

test.describe("public GET API endpoints return JSON 200 with expected keys", () => {
  for (const { path, keys } of PUBLIC_API_CHECKS) {
    test(`GET ${path}`, async ({ request }) => {
      const res = await request.get(`${BASE}${path}`);
      expect(res.status(), `${path} should return 200`).toBe(200);

      const ct = res.headers()["content-type"] ?? "";
      expect(ct, `${path} content-type should be JSON`).toContain("application/json");

      const json = await res.json().catch(() => null);
      expect(json, `${path} body should parse as JSON`).not.toBeNull();
      expect(typeof json).toBe("object");

      for (const key of keys) {
        expect(json, `${path} response missing key: ${key}`).toHaveProperty(key);
      }
    });
  }
});
