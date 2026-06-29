/**
 * POST /api/account/login
 *
 * Verifies a SIWE message + signature and mints a session.
 * Rate-limited to 20 requests/min per IP.
 *
 * Body: { message: string, signature: string }
 * Response: { address: string, token: string }
 *   - token is also set as __Host-sid cookie (HttpOnly, Secure, SameSite=Lax).
 *   - token is also returned in the body for the Telegram WebView Bearer fallback.
 *
 * INVARIANT: the address in the response (and every subsequent DB operation)
 * comes exclusively from the verified SIWE signature, never from the request body.
 */

import { mintSession, sessionCookie, verifyLogin } from "@/lib/account/session";
import { apiError } from "@/lib/api/apiError";
import { rateLimit } from "@/lib/api/rateLimit";
import { parseJsonBody } from "@/lib/api/validate";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const LoginSchema = z.object({
  message: z.string().min(1).max(4096),
  signature: z.string().regex(/^0x[0-9a-fA-F]+$/, "must be a 0x-prefixed hex signature"),
});

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { name: "account/login", limit: 20, windowMs: 60_000 });
  if (limited) return limited;

  const parsed = await parseJsonBody(req, LoginSchema, { tag: "account/login" });
  if (!parsed.ok) return parsed.res;

  const { message, signature } = parsed.data;

  try {
    const address = await verifyLogin(message, signature);
    if (!address) {
      return apiError("login_failed", 401);
    }

    const token = await mintSession(address);
    const cookie = sessionCookie(token);

    return NextResponse.json(
      { address, token },
      {
        status: 200,
        headers: { "Set-Cookie": cookie },
      },
    );
  } catch (e) {
    console.error("[account/login] error:", (e as Error).message);
    return apiError("login_failed", 500);
  }
}
