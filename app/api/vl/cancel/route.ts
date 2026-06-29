import { apiError } from "@/lib/api/apiError";
import { rateLimit } from "@/lib/api/rateLimit";
import { parseJsonBody, zAddress, zHex } from "@/lib/api/validate";
import { FxApiError, fxClient } from "@/lib/fx-provider/server-client";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

// POST { owner_address, vl_batch_id, signature } → FX provider /orders/vl/cancel.
// vl_batch_id is the UUID4 order_id of the batch's primary (first) leg; the
// signature is over the CancelVLBatch EIP-712 struct (owner address, vlBatchId string).

const VlCancelSchema = z.object({
  owner_address: zAddress,
  vl_batch_id: z.string().min(1),
  signature: zHex,
});

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { name: "vl-cancel", limit: 20, windowMs: 60_000 });
  if (limited) return limited;

  const parsed = await parseJsonBody(req, VlCancelSchema, { tag: "vl/cancel" });
  if (!parsed.ok) return parsed.res;
  const body = parsed.data;

  try {
    return NextResponse.json(
      await fxClient.postVlCancel({
        owner_address: body.owner_address,
        vl_batch_id: body.vl_batch_id,
        signature: body.signature,
      }),
    );
  } catch (e) {
    const status = e instanceof FxApiError ? e.status : 500;
    console.error("[vl/cancel] FX provider upstream error:", (e as Error).message);
    return apiError("vl_cancel_failed", status);
  }
}
