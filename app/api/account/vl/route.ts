/**
 * POST /api/account/vl
 *
 * Bookkeeping mirror for VL batches (does NOT call the FX provider — that is /api/vl/batch).
 * Stores a StoredVlBatch record for the authenticated wallet.
 * UPSERT by vl_batch_id scoped to session.address — the owner is ALWAYS session.address.
 * Rate-limited to 60 req/min per IP.
 *
 * Body: Omit<StoredVlBatch, "owner"> — the owner field is ignored if supplied;
 *       session.address is always used.
 * Response: { vlBatches: StoredVlBatch[] }  (open batches for this wallet)
 */

import { readSession } from "@/lib/account/session";
import { apiError } from "@/lib/api/apiError";
import { rateLimit } from "@/lib/api/rateLimit";
import { parseJsonBody } from "@/lib/api/validate";
import { sql } from "@/lib/db/client";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const VlBatchBodySchema = z.object({
  vlBatchId: z.string().uuid(),
  budgetSymbol: z.string().min(1).max(16),
  amount: z.string().min(1).max(78),
  legs: z
    .array(
      z.object({
        symbol: z.string().min(1).max(32),
        price: z.string().min(1).max(78),
      }),
    )
    .min(1)
    .max(50),
  expiration: z.number().int().min(0),
  createdAt: z.number().int().min(0),
});

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { name: "account/vl", limit: 60, windowMs: 60_000 });
  if (limited) return limited;

  const session = await readSession(req);
  if (!session) return apiError("unauthorized", 401);

  // INVARIANT: owner always comes from the session, never from the body.
  const { address } = session;

  const parsed = await parseJsonBody(req, VlBatchBodySchema, {
    tag: "account/vl",
    maxBytes: 16_384,
  });
  if (!parsed.ok) return parsed.res;

  const { vlBatchId, budgetSymbol, amount, legs, expiration, createdAt } = parsed.data;

  try {
    const legsJson = JSON.stringify(legs);

    await sql`
      INSERT INTO vl_batch
        (vl_batch_id, address, budget_symbol, amount, legs, expiration, created_at)
      VALUES
        (${vlBatchId}, ${address}, ${budgetSymbol}, ${amount}, ${legsJson}::jsonb, ${expiration}, ${createdAt})
      ON CONFLICT (vl_batch_id) DO UPDATE
        SET budget_symbol = EXCLUDED.budget_symbol,
            amount        = EXCLUDED.amount,
            legs          = EXCLUDED.legs,
            expiration    = EXCLUDED.expiration
        WHERE vl_batch.address = ${address}
    `;

    const openBatches = await queryOpenBatches(address);
    return NextResponse.json({ vlBatches: openBatches });
  } catch (e) {
    console.error("[account/vl] db error:", (e as Error).message);
    return apiError("vl_failed", 500);
  }
}

// ─── Shared helper ────────────────────────────────────────────────────────────

export async function queryOpenBatches(address: string) {
  const rows = await sql<
    {
      vl_batch_id: string;
      budget_symbol: string;
      amount: string;
      legs: { symbol: string; price: string }[];
      expiration: number;
      created_at: number;
    }[]
  >`
    SELECT vl_batch_id, budget_symbol, amount, legs, expiration, created_at
    FROM vl_batch
    WHERE address = ${address}
      AND cancelled_at IS NULL
    ORDER BY created_at DESC
  `;

  return rows.map((r) => ({
    vlBatchId: r.vl_batch_id,
    owner: address,
    budgetSymbol: r.budget_symbol,
    amount: r.amount,
    legs: r.legs,
    expiration: r.expiration,
    createdAt: r.created_at,
  }));
}
