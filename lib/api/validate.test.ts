/**
 * Tests for lib/api/validate.ts
 *
 * Covers: primitive schemas, byte cap, generic error bodies.
 * No network calls. Uses vitest fake timers where needed.
 */

import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  ALLOWED_CHAIN_IDS,
  parseJsonBody,
  zAddress,
  zChainId,
  zDecimals,
  zHex,
  zRawAmount,
} from "./validate";

// ─── Primitive schemas ────────────────────────────────────────────────────────

describe("zAddress", () => {
  it("accepts a valid checksummed address", () => {
    expect(zAddress.safeParse("0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48").success).toBe(true);
  });

  it("accepts lowercase 40-char address", () => {
    expect(zAddress.safeParse(`0x${"a".repeat(40)}`).success).toBe(true);
  });

  it("rejects missing 0x prefix", () => {
    expect(zAddress.safeParse("a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48").success).toBe(false);
  });

  it("rejects address that is too short", () => {
    expect(zAddress.safeParse(`0x${"a".repeat(39)}`).success).toBe(false);
  });

  it("rejects address that is too long", () => {
    expect(zAddress.safeParse(`0x${"a".repeat(41)}`).success).toBe(false);
  });

  it("rejects non-hex characters", () => {
    expect(zAddress.safeParse(`0x${"g".repeat(40)}`).success).toBe(false);
  });
});

describe("zHex", () => {
  it("accepts bare 0x", () => {
    expect(zHex.safeParse("0x").success).toBe(true);
  });

  it("accepts 0x followed by hex chars", () => {
    expect(zHex.safeParse("0xdeadbeef").success).toBe(true);
  });

  it("rejects missing 0x prefix", () => {
    expect(zHex.safeParse("deadbeef").success).toBe(false);
  });

  it("rejects non-hex after prefix", () => {
    expect(zHex.safeParse("0xgg").success).toBe(false);
  });
});

describe("zChainId", () => {
  it.each(ALLOWED_CHAIN_IDS)("accepts chain %i", (id) => {
    expect(zChainId.safeParse(id).success).toBe(true);
  });

  it("rejects unknown chain", () => {
    expect(zChainId.safeParse(56).success).toBe(false); // BSC
  });

  it("rejects float", () => {
    expect(zChainId.safeParse(1.5).success).toBe(false);
  });

  it("rejects string", () => {
    expect(zChainId.safeParse("1").success).toBe(false);
  });
});

describe("zRawAmount", () => {
  it("accepts a plain integer string", () => {
    expect(zRawAmount.safeParse("1000000").success).toBe(true);
  });

  it("accepts single digit", () => {
    expect(zRawAmount.safeParse("1").success).toBe(true);
  });

  it("accepts 78-char number", () => {
    expect(zRawAmount.safeParse("9".repeat(78)).success).toBe(true);
  });

  it("rejects empty string", () => {
    expect(zRawAmount.safeParse("").success).toBe(false);
  });

  it("rejects 79-char number (over uint256 length)", () => {
    expect(zRawAmount.safeParse("9".repeat(79)).success).toBe(false);
  });

  it("rejects decimal point", () => {
    expect(zRawAmount.safeParse("1.5").success).toBe(false);
  });

  it("rejects negative", () => {
    expect(zRawAmount.safeParse("-1").success).toBe(false);
  });
});

describe("zDecimals", () => {
  it("accepts 0", () => {
    expect(zDecimals.safeParse(0).success).toBe(true);
  });

  it("accepts 18 (ETH)", () => {
    expect(zDecimals.safeParse(18).success).toBe(true);
  });

  it("accepts 36 (max)", () => {
    expect(zDecimals.safeParse(36).success).toBe(true);
  });

  it("rejects 37", () => {
    expect(zDecimals.safeParse(37).success).toBe(false);
  });

  it("rejects -1", () => {
    expect(zDecimals.safeParse(-1).success).toBe(false);
  });

  it("rejects float", () => {
    expect(zDecimals.safeParse(6.5).success).toBe(false);
  });
});

// ─── parseJsonBody ────────────────────────────────────────────────────────────

const Schema = z.object({ value: z.string().min(1) });

function makeReq(body: string, contentLength?: number): NextRequest {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (contentLength !== undefined) headers["content-length"] = String(contentLength);
  return new NextRequest("http://localhost/test", {
    method: "POST",
    headers,
    body,
  });
}

describe("parseJsonBody", () => {
  it("returns ok:true with typed data for valid input", async () => {
    const req = makeReq(JSON.stringify({ value: "hello" }));
    const result = await parseJsonBody(req, Schema, { tag: "test" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.value).toBe("hello");
  });

  it("returns 400 with generic error for invalid JSON", async () => {
    const req = makeReq("{ bad json");
    const result = await parseJsonBody(req, Schema, { tag: "test" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.res.status).toBe(400);
      const body = await result.res.json();
      expect(body).toEqual({ error: "invalid JSON" });
    }
  });

  it("returns 400 with generic error for schema failure (no zod detail)", async () => {
    const req = makeReq(JSON.stringify({ value: "" })); // fails min(1)
    const result = await parseJsonBody(req, Schema, { tag: "test" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.res.status).toBe(400);
      const body = await result.res.json();
      expect(body).toEqual({ error: "invalid request" });
      // Must NOT contain zod field detail.
      expect(JSON.stringify(body)).not.toContain("String must contain");
      expect(JSON.stringify(body)).not.toContain("value");
    }
  });

  it("returns 413 when content-length header exceeds cap", async () => {
    const req = makeReq(JSON.stringify({ value: "ok" }), 99_999);
    const result = await parseJsonBody(req, Schema, { tag: "test", maxBytes: 100 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.res.status).toBe(413);
    }
  });

  it("returns 413 when body byte length exceeds cap (no Content-Length)", async () => {
    const big = JSON.stringify({ value: "x".repeat(200) });
    const req = makeReq(big);
    const result = await parseJsonBody(req, Schema, { tag: "test", maxBytes: 50 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.res.status).toBe(413);
    }
  });

  it("uses default 64 KiB cap when maxBytes is not specified", async () => {
    // Just over 64 KiB
    const big = JSON.stringify({ value: "x".repeat(65_537) });
    const req = makeReq(big);
    const result = await parseJsonBody(req, z.object({ value: z.string() }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.res.status).toBe(413);
    }
  });
});
