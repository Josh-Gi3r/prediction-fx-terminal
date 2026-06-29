/**
 * GET /api/account/nonce
 *
 * Issues a single-use server nonce for SIWE login.
 * Rate-limited to 20 requests/min per IP.
 *
 * Response: { nonce: string }
 */

import { createNonce } from "@/lib/account/session";
import { apiError } from "@/lib/api/apiError";
import { rateLimit } from "@/lib/api/rateLimit";
import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { name: "account/nonce", limit: 20, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const nonce = createNonce();
    return NextResponse.json({ nonce });
  } catch (e) {
    console.error("[account/nonce] error:", (e as Error).message);
    return apiError("nonce_failed", 500);
  }
}
