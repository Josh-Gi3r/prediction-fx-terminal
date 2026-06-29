/**
 * Tests for lib/api/rateLimit.ts
 *
 * Covers: burst → 429, Retry-After header, refill after window expires (faked
 * timers), per-route bucket isolation, extractIp fallback chain.
 */

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { _resetStore, extractIp, rateLimit } from "./rateLimit";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost/api/test", {
    method: "GET",
    headers,
  });
}

// ─── extractIp ────────────────────────────────────────────────────────────────

describe("extractIp", () => {
  it("returns first hop from x-forwarded-for", () => {
    const req = makeReq({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" });
    expect(extractIp(req)).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    const req = makeReq({ "x-real-ip": "9.10.11.12" });
    expect(extractIp(req)).toBe("9.10.11.12");
  });

  it('returns "unknown" when neither header is present', () => {
    const req = makeReq();
    expect(extractIp(req)).toBe("unknown");
  });
});

// ─── rateLimit ────────────────────────────────────────────────────────────────

describe("rateLimit — token bucket", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    _resetStore();
  });

  afterEach(() => {
    vi.useRealTimers();
    _resetStore();
  });

  it("allows requests within the limit", () => {
    const req = makeReq({ "x-forwarded-for": "10.0.0.1" });
    for (let i = 0; i < 3; i++) {
      const result = rateLimit(req, { name: "test", limit: 3, windowMs: 60_000 });
      expect(result).toBeNull();
    }
  });

  it("returns 429 on the first request that exceeds the limit", () => {
    const req = makeReq({ "x-forwarded-for": "10.0.0.2" });
    for (let i = 0; i < 3; i++) rateLimit(req, { name: "test", limit: 3, windowMs: 60_000 });
    const limited = rateLimit(req, { name: "test", limit: 3, windowMs: 60_000 });
    expect(limited).not.toBeNull();
    expect(limited?.status).toBe(429);
  });

  it("includes a Retry-After header on 429", async () => {
    const req = makeReq({ "x-forwarded-for": "10.0.0.3" });
    for (let i = 0; i < 2; i++) rateLimit(req, { name: "test", limit: 2, windowMs: 60_000 });
    const limited = rateLimit(req, { name: "test", limit: 2, windowMs: 60_000 });
    expect(limited?.headers.get("Retry-After")).toBeTruthy();
    const retryAfter = Number(limited?.headers.get("Retry-After"));
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(60);
  });

  it("429 response body contains {error:'Too many requests'}", async () => {
    const req = makeReq({ "x-forwarded-for": "10.0.0.4" });
    for (let i = 0; i < 1; i++) rateLimit(req, { name: "test", limit: 1, windowMs: 60_000 });
    const limited = rateLimit(req, { name: "test", limit: 1, windowMs: 60_000 });
    expect(limited).not.toBeNull();
    const body = await limited!.json();
    expect(body).toEqual({ error: "Too many requests" });
  });

  it("allows requests again after the window expires", () => {
    const req = makeReq({ "x-forwarded-for": "10.0.0.5" });
    for (let i = 0; i < 2; i++) rateLimit(req, { name: "test", limit: 2, windowMs: 60_000 });
    // Confirm limited.
    expect(rateLimit(req, { name: "test", limit: 2, windowMs: 60_000 })).not.toBeNull();
    // Advance past the window.
    vi.advanceTimersByTime(61_000);
    // Should be allowed again.
    expect(rateLimit(req, { name: "test", limit: 2, windowMs: 60_000 })).toBeNull();
  });

  it("buckets are isolated by route name", () => {
    const req = makeReq({ "x-forwarded-for": "10.0.0.6" });
    // Hit limit on "route-a".
    for (let i = 0; i < 2; i++) rateLimit(req, { name: "route-a", limit: 2, windowMs: 60_000 });
    expect(rateLimit(req, { name: "route-a", limit: 2, windowMs: 60_000 })).not.toBeNull();
    // "route-b" window is separate — should still allow.
    expect(rateLimit(req, { name: "route-b", limit: 2, windowMs: 60_000 })).toBeNull();
  });

  it("buckets are isolated by IP", () => {
    const reqA = makeReq({ "x-forwarded-for": "10.0.0.7" });
    const reqB = makeReq({ "x-forwarded-for": "10.0.0.8" });
    for (let i = 0; i < 2; i++) rateLimit(reqA, { name: "test", limit: 2, windowMs: 60_000 });
    // reqA exhausted.
    expect(rateLimit(reqA, { name: "test", limit: 2, windowMs: 60_000 })).not.toBeNull();
    // reqB independent.
    expect(rateLimit(reqB, { name: "test", limit: 2, windowMs: 60_000 })).toBeNull();
  });
});
