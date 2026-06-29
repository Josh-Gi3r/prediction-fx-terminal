import { rateLimit } from "@/lib/api/rateLimit";
import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { name: "capabilities", limit: 120, windowMs: 60_000 });
  if (limited) return limited;

  const hasKey = !!(process.env.FX_PROVIDER_API_KEY && process.env.FX_PROVIDER_API_SECRET);
  return NextResponse.json(
    { fxSettlement: hasKey, fxDeposit: hasKey },
    { headers: { "Cache-Control": "public, s-maxage=60" } },
  );
}
