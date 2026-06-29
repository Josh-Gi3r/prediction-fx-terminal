/**
 * lib/api/rateLimit.ts
 *
 * In-memory token-bucket rate limiter keyed by client IP.
 *
 * IMPORTANT — single-replica constraint:
 *   This implementation stores state in process memory. It is correct only
 *   when numReplicas=1 (see railway.toml). Before scaling to multiple replicas
 *   replace the in-process Map with a shared Redis/Upstash counter so all
 *   instances see the same window counts.
 *
 * Usage:
 *   const limited = rateLimit(req, { name: "scan", limit: 6, windowMs: 60_000 });
 *   if (limited) return limited; // 429 NextResponse with Retry-After
 */

import { type NextRequest, NextResponse } from "next/server";

// ─── Internal bucket store ────────────────────────────────────────────────────

interface Bucket {
  count: number;
  windowStart: number;
}

const store = new Map<string, Bucket>();

/** Sweep buckets idle for more than 10 minutes to bound memory growth. */
const IDLE_SWEEP_MS = 10 * 60 * 1_000;

function sweep(now: number): void {
  for (const [key, bucket] of store.entries()) {
    if (now - bucket.windowStart > IDLE_SWEEP_MS) {
      store.delete(key);
    }
  }
}

// Sweep at most once per minute to amortise the cost.
let lastSweep = 0;

function maybeSweep(now: number): void {
  if (now - lastSweep > 60_000) {
    sweep(now);
    lastSweep = now;
  }
}

// ─── IP extraction ────────────────────────────────────────────────────────────

/**
 * Extract the client IP from request headers.
 * Reads the first hop of x-forwarded-for, then x-real-ip, then falls back to
 * "unknown". The first hop is used because Railway terminates TLS and sets
 * x-forwarded-for to the real client IP in position 0.
 */
export function extractIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip") ?? "unknown";
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface RateLimitOptions {
  /** Descriptive name used in log output (e.g. "scan", "pm/order"). */
  name: string;
  /** Maximum requests allowed within the window. */
  limit: number;
  /** Window duration in milliseconds. */
  windowMs: number;
}

/**
 * Check and update the rate-limit bucket for the request's IP.
 *
 * Returns null if the request is within limits.
 * Returns a 429 NextResponse (with Retry-After header) if the limit is exceeded.
 *
 * The bucket key is `${name}:${ip}` so each route has its own independent window.
 */
export function rateLimit(req: NextRequest, opts: RateLimitOptions): NextResponse | null {
  const { name, limit, windowMs } = opts;
  const now = Date.now();

  maybeSweep(now);

  const ip = extractIp(req);
  const key = `${name}:${ip}`;

  const existing = store.get(key);

  if (!existing || now - existing.windowStart >= windowMs) {
    // New window.
    store.set(key, { count: 1, windowStart: now });
    return null;
  }

  if (existing.count >= limit) {
    // Limit exceeded. Calculate seconds until this window expires.
    const retryAfterSec = Math.ceil((windowMs - (now - existing.windowStart)) / 1_000);

    // Log the rejection. Truncate the IP for privacy in plain logs.
    const truncatedIp = ip.length > 8 ? `${ip.slice(0, 8)}…` : ip;
    console.warn(`[rateLimit] 429 route=${name} ip=${truncatedIp} count=${existing.count}`);

    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfterSec) },
      },
    );
  }

  existing.count++;
  return null;
}

// Exported for tests only — allows resetting state between test cases.
export function _resetStore(): void {
  store.clear();
  lastSweep = 0;
}
