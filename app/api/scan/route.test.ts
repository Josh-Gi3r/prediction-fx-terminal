/**
 * Unit tests for POST /api/scan route handler.
 *
 * Tests: malformed JSON, missing required fields, targets > 80 cap, happy path
 * shape, GET export absence check, and error mapping.
 *
 * The scan handler calls global fetch for KyberSwap and fxClient.postSwapQuoteBatch
 * for the FX provider. Both are mocked so no real network fires.
 *
 * Validation errors now return generic {"error":"invalid request"} — field-level
 * detail is logged server-side only (P1-1 fix).
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/fx-provider/server-client", () => {
  const FxApiError = class extends Error {
    constructor(
      public status: number,
      message: string,
      public body?: unknown,
    ) {
      super(message);
      this.name = "FxApiError";
    }
  };
  return {
    FxApiError,
    fxProvider: {
      postSwapQuoteBatch: vi.fn(),
      getSystemTime: vi.fn(),
    },
  };
});

// Stub global fetch so KyberSwap calls don't escape.
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const routeModule = await import("./route");
const { POST } = routeModule;
const serverClient = await import("@/lib/fx-provider/server-client");
const rateLimitMod = await import("@/lib/api/rateLimit");
const mockBatch = vi.mocked(serverClient.fxClient.postSwapQuoteBatch);
const mockSystemTime = vi.mocked(serverClient.fxClient.getSystemTime);

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/scan", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const USDC = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const USDT = "0xdac17f958d2ee523a2206206994597c13d831ec7";

function stubTarget(address: string, symbol: string) {
  return { address, symbol, decimals: 6 };
}

function kyberNoRoute() {
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ data: null }),
  });
}

/** Resolve mock with a partial batch response (route only reads route_params.minOutputAmount). */
function mockBatchResolve(items: unknown[]) {
  (mockBatch as unknown as { mockResolvedValueOnce: (v: unknown) => void }).mockResolvedValueOnce({
    items,
  });
}

describe("POST /api/scan — validation", () => {
  beforeEach(() => {
    mockBatch.mockReset();
    mockFetch.mockReset();
    mockSystemTime.mockReset();
    rateLimitMod._resetStore();
    // Default: system time returns plausible value.
    mockSystemTime.mockResolvedValue({ timestamp: Math.floor(Date.now() / 1000) });
  });

  it("returns 400 for malformed JSON", async () => {
    const req = new NextRequest("http://localhost/api/scan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{{not json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 400 when from_token is missing", async () => {
    const req = makeRequest({
      from_amount: "1000000",
      targets: [stubTarget(USDT, "USDT")],
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    // Generic error — field detail is server-side only.
    expect(body).toHaveProperty("error");
  });

  it("returns 400 when from_amount is missing", async () => {
    const req = makeRequest({
      from_token: USDC,
      targets: [stubTarget(USDT, "USDT")],
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 400 when targets is missing", async () => {
    const req = makeRequest({ from_token: USDC, from_amount: "1000000" });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 400 when targets exceeds 80", async () => {
    const targets = Array.from({ length: 81 }, (_, i) =>
      stubTarget(`0x${i.toString().padStart(40, "0")}`, `TK${i}`),
    );
    const req = makeRequest({ from_token: USDC, from_amount: "1000000", targets });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 200 with rows array on valid input (both sources return no route)", async () => {
    mockBatchResolve([{ ok: false, error: "no_liquidity" }]);
    kyberNoRoute();

    const req = makeRequest({
      from_token: USDC,
      from_decimals: 6,
      from_amount: "1000000",
      targets: [stubTarget(USDT, "USDT")],
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("rows");
    expect(Array.isArray(body.rows)).toBe(true);
    expect(body.rows).toHaveLength(1);
    const row = body.rows[0];
    expect(row).toHaveProperty("symbol", "USDT");
    expect(row.bestSource).toBeNull();
  });

  it("identifies fx-provider as bestSource when only FX provider returns a valid quote", async () => {
    const fxProviderOutRaw = "990000";
    // Route only reads route_params.minOutputAmount — stub just that field.
    mockBatchResolve([{ ok: true, quote: { route_params: { minOutputAmount: fxProviderOutRaw } } }]);
    kyberNoRoute();

    const req = makeRequest({
      from_token: USDC,
      from_decimals: 6,
      from_amount: "1000000",
      targets: [stubTarget(USDT, "USDT")],
    });
    const res = await POST(req);
    const body = await res.json();
    expect(body.rows[0].bestSource).toBe("fx-provider");
    expect(body.rows[0].fxProvider).toMatchObject({ ok: true, outRaw: fxProviderOutRaw });
  });
});

describe("POST /api/scan — route export contract", () => {
  it("exports POST but not GET", () => {
    // The route module was already imported above — check its exports directly.
    expect(typeof routeModule.POST).toBe("function");
    // GET export should not exist (POST-only route).
    expect((routeModule as Record<string, unknown>).GET).toBeUndefined();
  });
});
