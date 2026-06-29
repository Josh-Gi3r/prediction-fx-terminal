/**
 * lib/polymarket/builderSign.ts
 *
 * Pure validation + signing logic for the /api/pm/builder-sign route.
 *
 * Server-side only. Do not import from client components.
 * The import "server-only" guard lives in the route file (app/api/pm/builder-sign/route.ts)
 * so that this pure-logic module remains testable in vitest's node environment.
 */

import { BuilderSigner } from "@polymarket/builder-signing-sdk";

export interface BuilderSignRequest {
  method: string;
  path: string;
  body?: string;
  timestamp?: number;
}

export type BuilderHeaders = {
  POLY_BUILDER_API_KEY: string;
  POLY_BUILDER_PASSPHRASE: string;
  POLY_BUILDER_SIGNATURE: string;
  POLY_BUILDER_TIMESTAMP: string;
};

/** Allowed method + path combinations. Allowlist is intentionally tiny. */
const ALLOWED: ReadonlySet<string> = new Set(["POST /order"]);

/** Maximum body size the route will accept (8 KB). */
export const MAX_BODY_BYTES = 8_192;

/**
 * Validate a builder-sign request payload.
 *
 * Returns a string error reason on failure, null on success.
 */
export function validateBuilderSignRequest(req: BuilderSignRequest): string | null {
  const { method, path, body } = req;

  if (typeof method !== "string" || typeof path !== "string") {
    return "invalid request shape";
  }

  const key = `${method.toUpperCase()} ${path}`;
  if (!ALLOWED.has(key)) {
    return "method/path not allowed";
  }

  if (body !== undefined) {
    if (typeof body !== "string") {
      return "body must be a string";
    }
    if (new TextEncoder().encode(body).length > MAX_BODY_BYTES) {
      return "body too large";
    }
    // Validate that body is parseable JSON and contains signatureType === 0
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      return "body is not valid JSON";
    }
    // body is the full orderPayload which has structure: {order:{...}, owner, orderType}
    if (typeof parsed === "object" && parsed !== null) {
      const p = parsed as Record<string, unknown>;
      const order = p.order;
      if (typeof order === "object" && order !== null) {
        const o = order as Record<string, unknown>;
        if (o.signatureType !== undefined && o.signatureType !== 0) {
          return "only EOA signature type (0) is accepted";
        }
      }
    }
  }

  return null;
}

/**
 * Generate POLY_BUILDER_* headers for the given request.
 * Reads builder creds from environment -- must only be called server-side.
 */
export function signBuilderRequest(req: BuilderSignRequest): BuilderHeaders {
  const key = process.env.POLYMARKET_API_KEY;
  const secret = process.env.POLYMARKET_API_SECRET;
  const passphrase = process.env.POLYMARKET_API_PASSPHRASE;

  if (!key || !secret || !passphrase) {
    throw new Error("POLYMARKET_API_KEY/SECRET/PASSPHRASE not configured");
  }

  const signer = new BuilderSigner({ key, secret, passphrase });
  const headers = signer.createBuilderHeaderPayload(req.method, req.path, req.body, req.timestamp);

  return headers as BuilderHeaders;
}

// ─── simple in-memory per-IP rate limiter ────────────────────────────────────
// Token bucket: 30 requests per minute per IP.

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 30;

interface Bucket {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, Bucket>();

/** Returns true if the request is within the rate limit. */
export function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const existing = buckets.get(ip);

  if (!existing || now - existing.windowStart >= RATE_WINDOW_MS) {
    buckets.set(ip, { count: 1, windowStart: now });
    return true;
  }

  if (existing.count >= RATE_MAX) {
    return false;
  }

  existing.count++;
  return true;
}
