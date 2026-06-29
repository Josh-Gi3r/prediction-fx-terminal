import { apiError } from "@/lib/api/apiError";
import { rateLimit } from "@/lib/api/rateLimit";
import { FxApiError, fxClient } from "@/lib/fx-provider/server-client";
import { type NextRequest, NextResponse } from "next/server";

export const revalidate = 120;

// FX provider markets — full list, used by the VL maker flow to filter where the
// chosen budget token is the BASE (siblings share fromToken = BASE per spec).
export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { name: "fx-markets", limit: 30, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const { markets } = await fxClient.getMarkets();
    return NextResponse.json({ markets });
  } catch (e) {
    const status = e instanceof FxApiError ? e.status : 500;
    console.error("[fx-markets] FX provider upstream error:", (e as Error).message);
    return apiError("upstream_error", status);
  }
}
