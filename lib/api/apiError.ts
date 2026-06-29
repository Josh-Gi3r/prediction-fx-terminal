/**
 * lib/api/apiError.ts
 *
 * Standardised API error response helper.
 *
 * Usage:
 *   return apiError("upstream_error", 502);
 *   return apiError("invalid_request", 400);
 *
 * Error codes are opaque to the client — no upstream detail is leaked.
 * Server-side detail is logged with console.error before calling apiError.
 *
 * Callers MUST console.error the upstream detail before calling this so
 * errors remain observable in server logs without exposing internal state
 * to clients.
 */

import { NextResponse } from "next/server";

/**
 * Returns a NextResponse with { error: code } JSON and the given HTTP status.
 * Never includes upstream detail in the response body.
 */
export function apiError(code: string, status: number): NextResponse {
  return NextResponse.json({ error: code }, { status });
}
