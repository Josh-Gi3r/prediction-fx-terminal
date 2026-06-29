/**
 * DELETE /api/account/vl/[id]
 *
 * Soft-deletes a VL batch by setting cancelled_at = unix seconds now.
 * The WHERE clause includes address = session.address — a user can only
 * cancel their own batches; a mismatched id returns 404 (not 403, to
 * avoid leaking whether the id exists at all).
 * Rate-limited to 60 req/min per IP.
 *
 * Response: { vlBatches: StoredVlBatch[] }  (remaining open batches)
 */

import { queryOpenBatches } from "@/app/api/account/vl/route";
import { readSession } from "@/lib/account/session";
import { apiError } from "@/lib/api/apiError";
import { rateLimit } from "@/lib/api/rateLimit";
import { parseParam } from "@/lib/api/validate";
import { sql } from "@/lib/db/client";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, { name: "account/vl-delete", limit: 60, windowMs: 60_000 });
  if (limited) return limited;

  const session = await readSession(req);
  if (!session) return apiError("unauthorized", 401);

  // INVARIANT: address comes from session only.
  const { address } = session;

  const { id } = await params;
  const pidResult = parseParam(id, z.string().uuid(), { tag: "account/vl/[id]" });
  if (!pidResult.ok) return pidResult.res;
  const vlBatchId = pidResult.data;

  try {
    const nowSec = Math.floor(Date.now() / 1_000);

    // The AND address = ${address} is the authz check.
    // If the id belongs to a different wallet, the UPDATE touches 0 rows → 404.
    const result = await sql`
      UPDATE vl_batch
      SET cancelled_at = ${nowSec}
      WHERE vl_batch_id = ${vlBatchId}
        AND address     = ${address}
        AND cancelled_at IS NULL
    `;

    // postgres-js returns an array with a `count` property on the result.
    const affected = (result as unknown as { count: number }).count;
    if (affected === 0) {
      return apiError("not_found", 404);
    }

    const openBatches = await queryOpenBatches(address);
    return NextResponse.json({ vlBatches: openBatches });
  } catch (e) {
    console.error("[account/vl/[id]] db error:", (e as Error).message);
    return apiError("vl_cancel_failed", 500);
  }
}
