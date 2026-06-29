/**
 * POST /api/pm/builder-sign
 *
 * Remote builder signing endpoint consumed by @polymarket/builder-signing-sdk's
 * BuilderConfig.remoteBuilderConfig. The SDK POSTs:
 *   { method, path, body?, timestamp? }
 * and expects back a JSON object with POLY_BUILDER_* headers.
 *
 * The builder HMAC secret stays on the server -- the browser never sees it.
 *
 * Security:
 * - Method/path allowlisted to POST /order only.
 * - Body validated: must be valid JSON, must have order.signatureType === 0.
 * - Body size capped at 8 KB (parseJsonBody maxBytes).
 * - Per-IP rate limit: 30 requests per minute (shared rateLimit helper).
 * - Generic 400 errors -- no upstream detail echoed.
 * - 403 when NEXT_PUBLIC_FEATURE_PM_BETTING is not "true".
 */

import "server-only";

import { rateLimit } from "@/lib/api/rateLimit";
import { parseJsonBody } from "@/lib/api/validate";
import { signBuilderRequest, validateBuilderSignRequest } from "@/lib/polymarket/builderSign";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const BuilderSignSchema = z.object({
  method: z.string(),
  path: z.string(),
  body: z.string().optional(),
  timestamp: z.number().optional(),
});

export async function POST(req: NextRequest) {
  if (process.env.NEXT_PUBLIC_FEATURE_PM_BETTING !== "true") {
    return NextResponse.json({ error: "Feature not enabled" }, { status: 403 });
  }

  // Per-IP rate limit via shared helper (30 req/min matches original inline limit).
  const limited = rateLimit(req, { name: "pm/builder-sign", limit: 30, windowMs: 60_000 });
  if (limited) return limited;

  // Cap at 8 KB to match the original inline MAX_BODY_BYTES constraint.
  const parsed = await parseJsonBody(req, BuilderSignSchema, {
    tag: "pm/builder-sign",
    maxBytes: 8_192,
  });
  if (!parsed.ok) return parsed.res;
  const { method, path, body: orderBody, timestamp } = parsed.data;

  const validationError = validateBuilderSignRequest({
    method,
    path,
    body: orderBody,
    timestamp,
  });

  if (validationError) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const headers = signBuilderRequest({
      method,
      path,
      body: orderBody,
      timestamp,
    });
    return NextResponse.json(headers);
  } catch {
    return NextResponse.json({ error: "Signing unavailable" }, { status: 503 });
  }
}
