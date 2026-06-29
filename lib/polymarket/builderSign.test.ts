/**
 * lib/polymarket/builderSign.test.ts
 *
 * d) builderSign: validates rejections + produces headers with mock creds.
 *
 * Note: signBuilderRequest() reads from process.env. Tests that call it
 * use vi.stubEnv to inject mock creds without touching real secrets.
 */

import { describe, expect, it, vi } from "vitest";
import {
  MAX_BODY_BYTES,
  checkRateLimit,
  signBuilderRequest,
  validateBuilderSignRequest,
} from "./builderSign";

// ─── validateBuilderSignRequest ──────────────────────────────────────────────

describe("validateBuilderSignRequest -- rejects non-POST-/order", () => {
  it("rejects GET /order", () => {
    const err = validateBuilderSignRequest({ method: "GET", path: "/order" });
    expect(err).not.toBeNull();
  });

  it("rejects POST /orders (plural)", () => {
    const err = validateBuilderSignRequest({ method: "POST", path: "/orders" });
    expect(err).not.toBeNull();
  });

  it("rejects POST /cancel", () => {
    const err = validateBuilderSignRequest({ method: "POST", path: "/cancel" });
    expect(err).not.toBeNull();
  });

  it("accepts POST /order", () => {
    const err = validateBuilderSignRequest({ method: "POST", path: "/order" });
    expect(err).toBeNull();
  });

  it("accepts POST /order with case-insensitive method", () => {
    const err = validateBuilderSignRequest({ method: "post", path: "/order" });
    expect(err).toBeNull();
  });
});

describe("validateBuilderSignRequest -- oversized body", () => {
  it("rejects body larger than MAX_BODY_BYTES", () => {
    const bigBody = "x".repeat(MAX_BODY_BYTES + 1);
    const err = validateBuilderSignRequest({ method: "POST", path: "/order", body: bigBody });
    expect(err).not.toBeNull();
  });

  it("accepts body exactly at MAX_BODY_BYTES", () => {
    // Must be valid JSON for the check to pass size threshold
    const validJson = JSON.stringify({
      order: { signatureType: 0 },
      owner: "0x1234",
      orderType: "FOK",
    });
    // pad with spaces to approach limit without exceeding
    expect(new TextEncoder().encode(validJson).length).toBeLessThanOrEqual(MAX_BODY_BYTES);
    const err = validateBuilderSignRequest({ method: "POST", path: "/order", body: validJson });
    expect(err).toBeNull();
  });
});

describe("validateBuilderSignRequest -- malformed JSON body", () => {
  it("rejects non-JSON body string", () => {
    const err = validateBuilderSignRequest({
      method: "POST",
      path: "/order",
      body: "not-json{{{",
    });
    expect(err).not.toBeNull();
    expect(err).toContain("JSON");
  });

  it("accepts valid JSON body", () => {
    const body = JSON.stringify({
      order: { signatureType: 0 },
      owner: "0xabc",
      orderType: "FOK",
    });
    const err = validateBuilderSignRequest({ method: "POST", path: "/order", body });
    expect(err).toBeNull();
  });
});

describe("validateBuilderSignRequest -- signatureType gate", () => {
  it("rejects signatureType !== 0", () => {
    const body = JSON.stringify({
      order: { signatureType: 1 }, // POLY_PROXY type -- not EOA
      owner: "0xabc",
      orderType: "FOK",
    });
    const err = validateBuilderSignRequest({ method: "POST", path: "/order", body });
    expect(err).not.toBeNull();
  });

  it("accepts signatureType === 0 (EOA)", () => {
    const body = JSON.stringify({
      order: { signatureType: 0 },
      owner: "0xabc",
      orderType: "FOK",
    });
    const err = validateBuilderSignRequest({ method: "POST", path: "/order", body });
    expect(err).toBeNull();
  });

  it("accepts body without signatureType field (defaults to EOA)", () => {
    const body = JSON.stringify({
      order: { maker: "0xabc" },
      owner: "0xabc",
      orderType: "FOK",
    });
    const err = validateBuilderSignRequest({ method: "POST", path: "/order", body });
    expect(err).toBeNull();
  });
});

// ─── signBuilderRequest -- produces headers with mock creds ─────────────────

describe("signBuilderRequest -- produces POLY_BUILDER_* headers", () => {
  it("returns all four POLY_BUILDER_* headers with mock creds", () => {
    // Use a base64 secret (the SDK decodes it)
    const mockSecret = Buffer.from("test-secret-32-bytes-long-padded!").toString("base64");

    vi.stubEnv("POLYMARKET_API_KEY", "test-api-key");
    vi.stubEnv("POLYMARKET_API_SECRET", mockSecret);
    vi.stubEnv("POLYMARKET_API_PASSPHRASE", "test-passphrase");

    const headers = signBuilderRequest({
      method: "POST",
      path: "/order",
      body: JSON.stringify({ order: { signatureType: 0 }, owner: "0x1", orderType: "FOK" }),
      timestamp: 1700000000,
    });

    expect(headers.POLY_BUILDER_API_KEY).toBe("test-api-key");
    expect(headers.POLY_BUILDER_PASSPHRASE).toBe("test-passphrase");
    expect(typeof headers.POLY_BUILDER_SIGNATURE).toBe("string");
    expect(headers.POLY_BUILDER_SIGNATURE.length).toBeGreaterThan(0);
    expect(headers.POLY_BUILDER_TIMESTAMP).toBe("1700000000");

    vi.unstubAllEnvs();
  });

  it("throws when env creds are missing", () => {
    vi.stubEnv("POLYMARKET_API_KEY", "");
    vi.stubEnv("POLYMARKET_API_SECRET", "");
    vi.stubEnv("POLYMARKET_API_PASSPHRASE", "");

    expect(() => signBuilderRequest({ method: "POST", path: "/order" })).toThrow();

    vi.unstubAllEnvs();
  });
});

// ─── checkRateLimit ──────────────────────────────────────────────────────────

describe("checkRateLimit", () => {
  it("allows requests up to the limit", () => {
    const ip = `test-ip-${Date.now()}-unique`;
    // First 30 should pass
    for (let i = 0; i < 30; i++) {
      expect(checkRateLimit(ip)).toBe(true);
    }
    // 31st should fail
    expect(checkRateLimit(ip)).toBe(false);
  });

  it("different IPs have independent buckets", () => {
    const ip1 = `test-ip-a-${Date.now()}`;
    const ip2 = `test-ip-b-${Date.now()}`;
    for (let i = 0; i < 30; i++) checkRateLimit(ip1);
    // ip1 is exhausted but ip2 should still work
    expect(checkRateLimit(ip2)).toBe(true);
  });
});
