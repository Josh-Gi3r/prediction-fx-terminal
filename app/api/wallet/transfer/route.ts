/**
 * POST /api/wallet/transfer
 *
 * Proxies a Privy Wallet API transfer request on behalf of the authenticated user.
 *
 * AUTHORIZATION:
 *   - Basic auth (app-id:app-secret) is added here — the app secret is server-only,
 *     never exposed to the browser.
 *   - The privy-authorization-signature header is generated CLIENT-SIDE by
 *     useAuthorizationSignature() and forwarded verbatim here.  Privy verifies the
 *     signature against the user's enrollment key, so the server cannot initiate a
 *     transfer on its own — user consent is cryptographically required.
 *
 * TRUST BOUNDARY / TODO (P0-4 server binding):
 *   The walletId field in the request body is supplied by the client and is validated
 *   ONLY by Privy's authorization-signature check — i.e. if a valid sig is present for
 *   wallet W, Privy will accept the transfer.  A more defensive posture would verify
 *   server-side that walletId is actually owned by the calling user by resolving the
 *   caller's Privy session token (privy-id-token) and cross-checking against their
 *   linkedAccounts before forwarding.  This requires a server-side Privy SDK or
 *   /v1/users/me call with the user's ID token, which is not wired in this proxy today.
 *   The Privy authorization-signature IS the cryptographic boundary — no valid sig means
 *   no transfer — but an ownership pre-check would add defence-in-depth.
 *   TODO: add session-token verification once Privy ID-token validation is plumbed in.
 *
 * IDEMPOTENCY:
 *   The client generates a UUID per-submit and includes it as idempotencyKey in both
 *   the signed body and this route's payload.  The route forwards it as the
 *   `privy-idempotency-key` header, which Privy uses to deduplicate duplicate requests
 *   within a short window.  This prevents double-sends from double-clicks or retries.
 *
 * USER-PAYS GAS:
 *   When the Privy dashboard "user pays gas" toggle is enabled for ethereum/USDC and
 *   ethereum/USDT, Privy handles the ERC-4337 paymaster routing transparently. No
 *   special field is needed in the request body; the config lives entirely in the
 *   Privy dashboard per chain/token pair. The user's USDC/USDT balance covers gas.
 *
 * RESPONSE SHAPE:
 *   Privy returns a TransferActionResponse (see @privy-io/api-types).  The steps array
 *   is only included when ?include=steps is appended (buildTransferUrl does this).
 *   Step types relevant here:
 *     - evm_transaction:     hash in steps[].transaction_hash
 *     - evm_user_operation:  hash in steps[].bundle_transaction_hash (ERC-4337 path)
 *
 * Rate limit: 10 requests / minute per IP.
 */

import "server-only";

import { rateLimit } from "@/lib/api/rateLimit";
import { parseJsonBody } from "@/lib/api/validate";
import {
  PRIVY_API_BASE,
  TransferRouteSchema,
  buildTransferBody,
  buildTransferUrl,
} from "@/lib/privy/transfer";
import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// ─── Env ──────────────────────────────────────────────────────────────────────

const APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";
const APP_SECRET = process.env.PRIVY_APP_SECRET ?? "";

function missingCreds(): NextResponse {
  return NextResponse.json({ error: "transfer not configured" }, { status: 503 });
}

// ─── Step hash extraction ─────────────────────────────────────────────────────

/**
 * Extract the on-chain transaction hash from a Privy WalletActionStep.
 *
 * Two step shapes carry a hash:
 *   evm_transaction     → transaction_hash
 *   evm_user_operation  → bundle_transaction_hash  (ERC-4337 / paymaster path)
 *
 * external_transaction and svm_transaction don't apply here.
 */
function extractStepHash(step: Record<string, unknown>): string | null {
  if (step.type === "evm_transaction") {
    const h = step.transaction_hash;
    return typeof h === "string" && h.length > 0 ? h : null;
  }
  if (step.type === "evm_user_operation") {
    const h = step.bundle_transaction_hash;
    return typeof h === "string" && h.length > 0 ? h : null;
  }
  return null;
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Guard: refuse if server credentials are absent (flag not yet enabled)
  if (!APP_ID || !APP_SECRET) return missingCreds();

  const limited = rateLimit(req, { name: "wallet-transfer", limit: 10, windowMs: 60_000 });
  if (limited) return limited;

  const parsed = await parseJsonBody(req, TransferRouteSchema, { tag: "wallet-transfer" });
  if (!parsed.ok) return parsed.res;

  const { walletId, token, amount, to, authorizationSignature, idempotencyKey } = parsed.data;

  // Build the exact same body that the client signed (including the idempotencyKey).
  const body = buildTransferBody(token, amount, to, idempotencyKey);
  // buildTransferUrl already appends ?include=steps so the response contains
  // per-step transaction hashes.
  const privyUrl = buildTransferUrl(walletId);

  // Basic auth credential: base64(app_id:app_secret)
  const basicCreds = Buffer.from(`${APP_ID}:${APP_SECRET}`).toString("base64");

  let privyRes: Response;
  try {
    privyRes = await fetch(privyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${basicCreds}`,
        "privy-app-id": APP_ID,
        "privy-authorization-signature": authorizationSignature,
        // Idempotency: Privy deduplicates requests with the same key within a window.
        // The key was generated by the client and included in the signed body, so it
        // cannot be swapped after signing.
        "privy-idempotency-key": idempotencyKey,
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    console.error("[wallet-transfer] fetch to privy failed:", e);
    return NextResponse.json({ error: "upstream request failed" }, { status: 502 });
  }

  // Parse Privy's response
  let privyJson: unknown;
  try {
    privyJson = await privyRes.json();
  } catch {
    return NextResponse.json({ error: "invalid upstream response" }, { status: 502 });
  }

  if (!privyRes.ok) {
    // Forward Privy's error message — it is informative (e.g. "insufficient balance")
    // but does not leak internal secrets.
    const msg =
      typeof privyJson === "object" &&
      privyJson !== null &&
      "message" in privyJson &&
      typeof (privyJson as Record<string, unknown>).message === "string"
        ? ((privyJson as Record<string, unknown>).message as string)
        : `privy ${privyRes.status}`;

    // Map common Privy status codes to sensible HTTP responses.
    const status = privyRes.status === 400 ? 422 : privyRes.status >= 500 ? 502 : privyRes.status;
    return NextResponse.json({ error: msg }, { status });
  }

  // Privy returns a TransferActionResponse. The steps array is present because we
  // requested ?include=steps. Each step carries a hash in a field that depends on
  // the step type (see extractStepHash above).
  const action = privyJson as Record<string, unknown>;
  const steps = Array.isArray(action.steps) ? (action.steps as Record<string, unknown>[]) : [];
  const txHash = steps.map(extractStepHash).find((h): h is string => h !== null) ?? null;

  return NextResponse.json({
    actionId: action.id ?? "",
    status: action.status ?? "pending",
    txHash,
  });
}
