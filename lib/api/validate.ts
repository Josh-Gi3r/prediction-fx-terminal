/**
 * lib/api/validate.ts
 *
 * Shared runtime-validation helpers for Next.js API routes.
 *
 * Usage:
 *   const result = await parseJsonBody(req, MySchema, { tag: "route-name" });
 *   if (!result.ok) return result.res;
 *   const data = result.data; // typed
 *
 *   // For GET query params:
 *   const qResult = parseQuery(req, MyQuerySchema, { tag: "route-name" });
 *   if (!qResult.ok) return qResult.res;
 */

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// ─── Config ──────────────────────────────────────────────────────────────────

const DEFAULT_MAX_BYTES = 65_536; // 64 KiB

// ─── Primitive schemas ────────────────────────────────────────────────────────

/** Ethereum address: 0x followed by exactly 40 hex chars (checksum-agnostic). */
export const zAddress = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/, "must be a 0x-prefixed 40-char hex address");

/**
 * Hex string: 0x-prefixed, arbitrary length (covers signatures, tx hashes,
 * UUIDs-as-hex, etc). At least 2 chars (bare "0x" is accepted as a
 * placeholder — callers add further constraints as needed).
 */
export const zHex = z.string().regex(/^0x[0-9a-fA-F]*$/, "must be a 0x-prefixed hex string");

/** EIP-155 chain IDs we route to. Extend the list here if new chains are added. */
export const ALLOWED_CHAIN_IDS = [1, 8453, 137, 42161] as const;
export const zChainId = z
  .number()
  .int()
  .refine(
    (v): v is (typeof ALLOWED_CHAIN_IDS)[number] =>
      (ALLOWED_CHAIN_IDS as readonly number[]).includes(v),
    { message: `chainId must be one of ${ALLOWED_CHAIN_IDS.join(", ")}` },
  );

/**
 * Raw token amount: decimal-string representation of a uint256.
 * 1–78 chars, digits only (no sign, no decimal point, no underscores).
 */
export const zRawAmount = z
  .string()
  .min(1)
  .max(78)
  .regex(/^\d+$/, "must be a decimal integer string");

/** Token decimal places. */
export const zDecimals = z.number().int().min(0).max(36);

// ─── Core helper ─────────────────────────────────────────────────────────────

export type ParseResult<T> = { ok: true; data: T } | { ok: false; res: NextResponse };

/**
 * Read + validate the JSON body of a NextRequest.
 *
 * Steps:
 *  1. Check Content-Length header (if present) against maxBytes.
 *  2. Read the body as text and check byte length against maxBytes.
 *  3. Parse JSON — invalid JSON → 400 {"error":"invalid JSON"}.
 *  4. Run schema.safeParse — failure → 400 {"error":"invalid request"}.
 *     Zod issue details are NEVER sent to the client; they are logged
 *     server-side via console.warn with the supplied route tag.
 *
 * @param req     The incoming NextRequest.
 * @param schema  A Zod schema to validate the parsed body against.
 * @param opts    Optional config (maxBytes cap, route tag for logging).
 */
export async function parseJsonBody<T>(
  req: NextRequest,
  schema: z.ZodType<T>,
  opts?: { maxBytes?: number; tag?: string },
): Promise<ParseResult<T>> {
  const maxBytes = opts?.maxBytes ?? DEFAULT_MAX_BYTES;
  const tag = opts?.tag ?? "unknown-route";

  // Fast path: Content-Length header present and already over limit.
  const clHeader = req.headers.get("content-length");
  if (clHeader !== null) {
    const cl = Number(clHeader);
    if (!Number.isNaN(cl) && cl > maxBytes) {
      return {
        ok: false,
        res: NextResponse.json({ error: "request too large" }, { status: 413 }),
      };
    }
  }

  // Read raw text so we can check exact byte size before JSON.parse.
  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return {
      ok: false,
      res: NextResponse.json({ error: "invalid JSON" }, { status: 400 }),
    };
  }

  if (new TextEncoder().encode(raw).length > maxBytes) {
    return {
      ok: false,
      res: NextResponse.json({ error: "request too large" }, { status: 413 }),
    };
  }

  // Parse JSON.
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      res: NextResponse.json({ error: "invalid JSON" }, { status: 400 }),
    };
  }

  // Schema validation.
  const result = schema.safeParse(parsed);
  if (!result.success) {
    // Log flattened issues server-side; never echo to client.
    console.warn(`[validate] ${tag} — invalid request:`, result.error.flatten());
    return {
      ok: false,
      res: NextResponse.json({ error: "invalid request" }, { status: 400 }),
    };
  }

  return { ok: true, data: result.data };
}

// ─── GET query/param helpers ──────────────────────────────────────────────────

/**
 * Validate GET query parameters from a NextRequest.
 *
 * Extracts all URLSearchParams as a plain Record<string, string> and runs
 * the schema against it.
 *
 * Usage:
 *   const q = parseQuery(req, z.object({ address: zAddress }), { tag: "pm/positions" });
 *   if (!q.ok) return q.res;
 *   const { address } = q.data;
 */
export function parseQuery<T>(
  req: NextRequest,
  schema: z.ZodType<T>,
  opts?: { tag?: string },
): ParseResult<T> {
  const tag = opts?.tag ?? "unknown-route";
  const raw: Record<string, string> = {};
  req.nextUrl.searchParams.forEach((value, key) => {
    raw[key] = value;
  });

  const result = schema.safeParse(raw);
  if (!result.success) {
    console.warn(`[validate] ${tag} — invalid query params:`, result.error.flatten());
    return {
      ok: false,
      res: NextResponse.json({ error: "invalid request" }, { status: 400 }),
    };
  }

  return { ok: true, data: result.data };
}

/**
 * Validate a single dynamic route segment (e.g. [key] or [id]).
 * Returns a ParseResult wrapping the validated string value.
 *
 * Usage:
 *   const p = parseParam(params.key, z.string().regex(/^wc:/), { tag: "wc/book/[key]" });
 *   if (!p.ok) return p.res;
 *   const key = p.data;
 */
export function parseParam<T>(
  value: string | undefined,
  schema: z.ZodType<T>,
  opts?: { tag?: string },
): ParseResult<T> {
  const tag = opts?.tag ?? "unknown-route";
  const result = schema.safeParse(value);
  if (!result.success) {
    console.warn(`[validate] ${tag} — invalid path param "${value}":`, result.error.flatten());
    return {
      ok: false,
      res: NextResponse.json({ error: "invalid request" }, { status: 400 }),
    };
  }
  return { ok: true, data: result.data };
}
