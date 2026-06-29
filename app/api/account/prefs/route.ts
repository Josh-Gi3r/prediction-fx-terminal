/**
 * PUT /api/account/prefs
 *
 * Upserts the authenticated wallet's AccountPrefs.
 * Body is validated against a strict schema — unknown keys are rejected.
 * Server-side deep-merge into account_state.prefs JSONB.
 * Rate-limited to 60 req/min per address+IP.
 *
 * Body: Partial<AccountPrefs> (unknown keys → 400)
 * Response: { prefs: AccountPrefs }
 */

import { readSession } from "@/lib/account/session";
import { apiError } from "@/lib/api/apiError";
import { extractIp, rateLimit } from "@/lib/api/rateLimit";
import { parseJsonBody } from "@/lib/api/validate";
import { sql } from "@/lib/db/client";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

// ─── Strict prefs schema ──────────────────────────────────────────────────────
// Mirrors AccountPrefs exactly. .strict() rejects any extra keys.

const NotificationPrefsSchema = z
  .object({
    betFilled: z.boolean(),
    orderFilled: z.boolean(),
    marketResolves: z.boolean(),
    p2p: z.boolean(),
  })
  .strict();

const PatchPrefsSchema = z
  .object({
    slippageBps: z
      .union([z.literal(10), z.literal(50), z.literal(100), z.number().int().min(1).max(10000)])
      .optional(),
    slippageCustom: z.string().max(10).nullable().optional(),
    settlementStablecoin: z.string().min(1).max(16).optional(),
    defaultChain: z.number().int().min(1).optional(),
    oddsFormat: z.enum(["cents", "percent", "american"]).optional(),
    notifications: NotificationPrefsSchema.optional(),
  })
  .strict();

type PatchPrefs = z.infer<typeof PatchPrefsSchema>;

export async function PUT(req: NextRequest) {
  // Rate-limit keyed by address+IP (address comes from session, so IP alone is the
  // pre-auth key; we tighten post-auth below by prefixing with the address).
  const limited = rateLimit(req, { name: "account/prefs", limit: 60, windowMs: 60_000 });
  if (limited) return limited;

  const session = await readSession(req);
  if (!session) return apiError("unauthorized", 401);

  // INVARIANT: only session.address is used for the DB write.
  const { address } = session;

  // Additional per-address rate-limit bucket (share the same in-memory store
  // under a different key, so the 60/min is per-address not just per-IP).
  const addrLimited = rateLimit(
    {
      ...req,
      headers: new Headers({
        ...Object.fromEntries(req.headers.entries()),
        "x-forwarded-for": `addr:${address}:${extractIp(req)}`,
      }),
    } as NextRequest,
    { name: "account/prefs-addr", limit: 60, windowMs: 60_000 },
  );
  if (addrLimited) return addrLimited;

  const parsed = await parseJsonBody(req, PatchPrefsSchema, {
    tag: "account/prefs",
    maxBytes: 8_192,
  });
  if (!parsed.ok) return parsed.res;

  const patch: PatchPrefs = parsed.data;

  try {
    // Build a JSON patch object for the JSONB merge.
    // We use jsonb_strip_nulls-safe approach: pass the patch as a JSON literal
    // and let Postgres deep-merge via || (jsonb concatenation), which is a
    // shallow merge.  For the notifications sub-object we merge explicitly.
    const patchJson = JSON.stringify(buildMergePatch(patch));

    const rows = await sql<{ prefs: Record<string, unknown> }[]>`
      INSERT INTO account_state (address, prefs, updated_at)
      VALUES (
        ${address},
        ${patchJson}::jsonb,
        now()
      )
      ON CONFLICT (address) DO UPDATE
        SET prefs = account_state.prefs
            || ${patchJson}::jsonb
            || CASE
                 WHEN ${patchJson}::jsonb ? 'notifications'
                 THEN jsonb_build_object(
                   'notifications',
                   COALESCE(account_state.prefs->'notifications', '{}'::jsonb)
                   || (${patchJson}::jsonb->'notifications')
                 )
                 ELSE '{}'::jsonb
               END,
          updated_at = now()
      RETURNING prefs
    `;

    const prefs = rows[0]?.prefs ?? {};
    return NextResponse.json({ prefs });
  } catch (e) {
    console.error("[account/prefs] db error:", (e as Error).message);
    return apiError("prefs_failed", 500);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Strip undefined values so we only send fields the client explicitly patched.
 * This prevents overwriting server-stored fields with undefined.
 */
function buildMergePatch(patch: PatchPrefs): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}
