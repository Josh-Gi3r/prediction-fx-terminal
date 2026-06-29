import { apiError } from "@/lib/api/apiError";
import { rateLimit } from "@/lib/api/rateLimit";
import { parseJsonBody } from "@/lib/api/validate";
import { FxApiError, fxClient } from "@/lib/fx-provider/server-client";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

// POST body: { orders: SignedOrderBody[] } where each is the schema lifted from
// fx-provider schemas (owner_address, side, amount, price, order_type:"limit",
// from_address, to_address, order_id, uuid_int, signature, expiration).
// The FX provider validates each signature against the Order EIP-712 struct.

const VlBatchSchema = z.object({
  orders: z
    .array(z.unknown())
    .min(2, "orders[] must have 2–50 signed legs")
    .max(50, "orders[] must have 2–50 signed legs"),
});

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { name: "vl-batch", limit: 20, windowMs: 60_000 });
  if (limited) return limited;

  const parsed = await parseJsonBody(req, VlBatchSchema, { tag: "vl/batch" });
  if (!parsed.ok) return parsed.res;

  try {
    return NextResponse.json(await fxClient.postVlBatch(parsed.data.orders));
  } catch (e) {
    const status = e instanceof FxApiError ? e.status : 500;
    console.error("[vl/batch] FX provider upstream error:", (e as Error).message);
    return apiError("vl_batch_failed", status);
  }
}
