/**
 * Unit tests for POST /api/vl/cancel route handler.
 *
 * Tests: malformed JSON, missing required fields (owner_address, vl_batch_id,
 * signature), happy path forwarding, FxApiError passthrough, generic 500.
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
      postVlCancel: vi.fn(),
    },
  };
});

const { POST } = await import("./route");
const serverClient = await import("@/lib/fx-provider/server-client");
const rateLimitMod = await import("@/lib/api/rateLimit");
const mockPostVlCancel = vi.mocked(serverClient.fxClient.postVlCancel);

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/vl/cancel", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const VALID_BODY = {
  owner_address: "0x1234567890123456789012345678901234567890",
  vl_batch_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  signature: "0xabcdef1234",
};

describe("POST /api/vl/cancel — validation", () => {
  beforeEach(() => {
    mockPostVlCancel.mockReset();
    rateLimitMod._resetStore();
  });

  it("returns 400 for malformed JSON", async () => {
    const req = new NextRequest("http://localhost/api/vl/cancel", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{broken::",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 400 when owner_address is missing", async () => {
    const req = makeRequest({
      vl_batch_id: VALID_BODY.vl_batch_id,
      signature: VALID_BODY.signature,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    // Generic error — field detail is server-side only.
    expect(body).toHaveProperty("error");
  });

  it("returns 400 when vl_batch_id is missing", async () => {
    const req = makeRequest({
      owner_address: VALID_BODY.owner_address,
      signature: VALID_BODY.signature,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 400 when signature is missing", async () => {
    const req = makeRequest({
      owner_address: VALID_BODY.owner_address,
      vl_batch_id: VALID_BODY.vl_batch_id,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 400 when all three fields are missing (empty body)", async () => {
    const req = makeRequest({});
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("calls postVlCancel with the correct payload and returns its result", async () => {
    mockPostVlCancel.mockResolvedValueOnce({ canceled: true });
    const req = makeRequest(VALID_BODY);
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.canceled).toBe(true);
    expect(mockPostVlCancel).toHaveBeenCalledWith(VALID_BODY);
  });

  it("maps FxApiError status to response status", async () => {
    const { FxApiError } = serverClient;
    mockPostVlCancel.mockRejectedValueOnce(new FxApiError(404, "ORDER_NOT_FOUND"));
    const req = makeRequest(VALID_BODY);
    const res = await POST(req);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("vl_cancel_failed"); // opaque code, upstream detail not leaked
  });

  it("returns 500 for unexpected errors", async () => {
    mockPostVlCancel.mockRejectedValueOnce(new Error("network down"));
    const req = makeRequest(VALID_BODY);
    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});
