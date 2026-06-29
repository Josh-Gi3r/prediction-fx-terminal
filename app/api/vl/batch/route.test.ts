/**
 * Unit tests for POST /api/vl/batch route handler.
 *
 * Tests: malformed JSON, missing orders[], wrong count (< 2 / > 50), happy path,
 * FxApiError passthrough, and generic 500 mapping.
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
      postVlBatch: vi.fn(),
    },
  };
});

const { POST } = await import("./route");
const serverClient = await import("@/lib/fx-provider/server-client");
const rateLimitMod = await import("@/lib/api/rateLimit");
const mockPostVlBatch = vi.mocked(serverClient.fxClient.postVlBatch);

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/vl/batch", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

// Minimal signed order stub — content not validated by the route layer.
function stubOrder(n: number) {
  return {
    owner_address: "0x1111111111111111111111111111111111111111",
    order_id: `order-${n}`,
    uuid_int: "12345",
    signature: `0x${n.toString(16).padStart(2, "0")}`,
  };
}

describe("POST /api/vl/batch — validation", () => {
  beforeEach(() => {
    mockPostVlBatch.mockReset();
    rateLimitMod._resetStore();
  });

  it("returns 400 for malformed JSON", async () => {
    const req = new NextRequest("http://localhost/api/vl/batch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not json !!!",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 400 when orders is missing", async () => {
    const req = makeRequest({});
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 400 when orders has only 1 leg", async () => {
    const req = makeRequest({ orders: [stubOrder(0)] });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 400 when orders has 51 legs (over cap)", async () => {
    const orders = Array.from({ length: 51 }, (_, i) => stubOrder(i));
    const req = makeRequest({ orders });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("calls postVlBatch and returns its result for 2 valid legs", async () => {
    const payload = {
      vl_batch_id: "batch-uuid",
      placed: [stubOrder(0), stubOrder(1)],
    };
    mockPostVlBatch.mockResolvedValueOnce(payload);
    const req = makeRequest({ orders: [stubOrder(0), stubOrder(1)] });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.vl_batch_id).toBe("batch-uuid");
  });

  it("accepts exactly 50 legs (boundary)", async () => {
    const orders = Array.from({ length: 50 }, (_, i) => stubOrder(i));
    mockPostVlBatch.mockResolvedValueOnce({ vl_batch_id: "b", placed: orders });
    const req = makeRequest({ orders });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it("maps FxApiError status to response status", async () => {
    const { FxApiError } = serverClient;
    mockPostVlBatch.mockRejectedValueOnce(new FxApiError(402, "INSUFFICIENT_EQUITY"));
    const req = makeRequest({ orders: [stubOrder(0), stubOrder(1)] });
    const res = await POST(req);
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error).toBe("vl_batch_failed"); // opaque code, upstream detail not leaked
  });

  it("returns 500 for unexpected errors", async () => {
    mockPostVlBatch.mockRejectedValueOnce(new Error("boom"));
    const req = makeRequest({ orders: [stubOrder(0), stubOrder(1)] });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});
