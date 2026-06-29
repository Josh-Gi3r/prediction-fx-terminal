/**
 * GET /api/account/state
 *
 * Returns the authenticated wallet's prefs + open VL batches.
 * The address for every DB query comes exclusively from readSession(req).
 * Rate-limited to 120 req/min per IP.
 *
 * Response: { prefs: AccountPrefs | null, vlBatches: StoredVlBatch[] }
 */

import { readSession } from "@/lib/account/session";
import { apiError } from "@/lib/api/apiError";
import { rateLimit } from "@/lib/api/rateLimit";
import { sql } from "@/lib/db/client";
import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { name: "account/state", limit: 120, windowMs: 60_000 });
  if (limited) return limited;

  const session = await readSession(req);
  if (!session) return apiError("unauthorized", 401);

  // INVARIANT: session.address is the only source of identity for these queries.
  const { address } = session;

  try {
    const [stateRows, batchRows] = await Promise.all([
      sql<{ prefs: Record<string, unknown> }[]>`
        SELECT prefs
        FROM account_state
        WHERE address = ${address}
        LIMIT 1
      `,
      sql<
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
      `,
    ]);

    const prefs = stateRows[0]?.prefs ?? null;
    const vlBatches = batchRows.map((r) => ({
      vlBatchId: r.vl_batch_id,
      owner: address,
      budgetSymbol: r.budget_symbol,
      amount: r.amount,
      legs: r.legs,
      expiration: r.expiration,
      createdAt: r.created_at,
    }));

    return NextResponse.json({ prefs, vlBatches });
  } catch (e) {
    console.error("[account/state] db error:", (e as Error).message);
    return apiError("state_failed", 500);
  }
}
