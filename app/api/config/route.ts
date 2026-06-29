import { apiError } from "@/lib/api/apiError";
import { rateLimit } from "@/lib/api/rateLimit";
import { FxApiError, fxClient } from "@/lib/fx-provider/server-client";
import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { name: "config", limit: 120, windowMs: 60_000 });
  if (limited) return limited;

  try {
    return NextResponse.json(await fxClient.getConfig());
  } catch (e) {
    const status = e instanceof FxApiError ? e.status : 500;
    console.error("[config] FX provider upstream error:", (e as Error).message);
    return apiError("upstream_error", status);
  }
}
