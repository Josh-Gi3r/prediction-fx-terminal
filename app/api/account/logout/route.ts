/**
 * POST /api/account/logout
 *
 * Clears the __Host-sid session cookie.
 * Returns 204 No Content.
 */

import { clearCookie } from "@/lib/account/session";
import { rateLimit } from "@/lib/api/rateLimit";
import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { name: "account/logout", limit: 20, windowMs: 60_000 });
  if (limited) return limited;

  return new NextResponse(null, {
    status: 204,
    headers: { "Set-Cookie": clearCookie() },
  });
}
