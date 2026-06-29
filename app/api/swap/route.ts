import { apiError } from "@/lib/api/apiError";
import { rateLimit } from "@/lib/api/rateLimit";
import { parseJsonBody, zHex } from "@/lib/api/validate";
import { FxApiError, fxClient } from "@/lib/fx-provider/server-client";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

// POST /swap is unauthenticated — the EIP-712 signature IS the auth (verified in
// FX provider client: postSwap has no auth header). No API key needed.

const SwapSchema = z
  .object({
    uuid: z.string().min(1),
    signature: zHex,
    permit_signature: zHex.optional(),
    permit_deadline: z.number().int().positive().optional(),
  })
  .refine((b) => (b.permit_signature == null) === (b.permit_deadline == null), {
    message: "permit_signature and permit_deadline must be provided together",
    path: ["permit_signature"],
  });

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { name: "swap", limit: 20, windowMs: 60_000 });
  if (limited) return limited;

  const result = await parseJsonBody(req, SwapSchema, { tag: "swap" });
  if (!result.ok) return result.res;
  const b = result.data;

  // Preserve the original permit-pair error message for any callers that match on it.
  // (safeParse already handles this via the refine above, but keeping it explicit.)

  try {
    const res = await fxClient.postSwap({
      uuid: b.uuid,
      signature: b.signature,
      ...(b.permit_signature
        ? { permit_signature: b.permit_signature, permit_deadline: b.permit_deadline }
        : {}),
    });
    return NextResponse.json(res);
  } catch (e) {
    const status = e instanceof FxApiError ? e.status : 500;
    console.error("[swap] FX provider upstream error:", (e as Error).message);
    return apiError("swap_failed", status);
  }
}
