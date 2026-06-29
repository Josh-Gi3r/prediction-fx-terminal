/**
 * Unit tests for POST /api/swap route handler.
 *
 * No network calls. The server-client (fxClient.postSwap) is vi.mocked so the handler
 * logic is tested in isolation: validation branches, error mapping, happy path shape.
 *
 * server-only is stubbed globally because it's a side-effect-only package that
 * enforces a server boundary at import time — in vitest (node env) it has no effect.
 *
 * Validation errors now return generic {"error":"invalid request"} — field-level
 * detail is logged server-side only (P1-1 fix).
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Stub server-only before the route is imported — it throws if imported outside Next.js.
vi.mock("server-only", () => ({}));

// Stub the server-client so no real HTTP fires.
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
      postSwap: vi.fn(),
    },
  };
});

// Import after mocks are in place.
const { POST } = await import("./route");
const serverClient = await import("@/lib/fx-provider/server-client");
const rateLimitMod = await import("@/lib/api/rateLimit");
const mockPostSwap = vi.mocked(serverClient.fxClient.postSwap);

// Valid hex signature for test inputs.
const VALID_SIG =
  "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab";

function makeRequest(body: unknown, method = "POST"): NextRequest {
  return new NextRequest("http://localhost/api/swap", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/swap — validation", () => {
  beforeEach(() => {
    mockPostSwap.mockReset();
    rateLimitMod._resetStore();
  });

  it("returns 400 for malformed JSON", async () => {
    const req = new NextRequest("http://localhost/api/swap", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{ not valid json {{",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 400 when uuid is missing", async () => {
    const req = makeRequest({ signature: VALID_SIG });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    // Generic error — field detail is server-side only.
    expect(body).toHaveProperty("error");
  });

  it("returns 400 when signature is missing", async () => {
    const req = makeRequest({ uuid: "some-uuid" });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 400 when permit fields are provided asymmetrically (signature only)", async () => {
    const req = makeRequest({
      uuid: "test-uuid",
      signature: VALID_SIG,
      permit_signature: VALID_SIG,
      // permit_deadline intentionally omitted
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 400 when permit fields are provided asymmetrically (deadline only)", async () => {
    const req = makeRequest({
      uuid: "test-uuid",
      signature: VALID_SIG,
      permit_deadline: 1780000000,
      // permit_signature intentionally omitted
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("calls postSwap and returns its result on valid input", async () => {
    const payload = {
      success: true,
      trade_id: "trade-abc",
      status: "pending",
    };
    mockPostSwap.mockResolvedValueOnce(payload);
    const req = makeRequest({ uuid: "test-uuid", signature: VALID_SIG });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.trade_id).toBe("trade-abc");
  });

  it("passes permit fields to postSwap when both are provided", async () => {
    mockPostSwap.mockResolvedValueOnce({ success: true, trade_id: "t2", status: "pending" });
    const PERMIT_SIG = "0xdeadbeef01";
    const req = makeRequest({
      uuid: "test-uuid",
      signature: VALID_SIG,
      permit_signature: PERMIT_SIG,
      permit_deadline: 1780000000,
    });
    await POST(req);
    expect(mockPostSwap).toHaveBeenCalledWith(
      expect.objectContaining({
        uuid: "test-uuid",
        signature: VALID_SIG,
        permit_signature: PERMIT_SIG,
        permit_deadline: 1780000000,
      }),
    );
  });

  it("maps FxApiError status to the response status code", async () => {
    const { FxApiError } = serverClient;
    mockPostSwap.mockRejectedValueOnce(new FxApiError(422, "Signature invalid"));
    const req = makeRequest({ uuid: "test-uuid", signature: VALID_SIG });
    const res = await POST(req);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("swap_failed"); // opaque code, upstream detail not leaked
  });

  it("returns 500 for unexpected errors", async () => {
    mockPostSwap.mockRejectedValueOnce(new Error("unexpected"));
    const req = makeRequest({ uuid: "test-uuid", signature: VALID_SIG });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});
