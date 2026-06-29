/**
 * lib/privy/transfer.ts
 *
 * Shared types and request-builder for Privy Wallet API token transfers.
 *
 * AUTHORIZATION MODEL (docs.privy.io/wallet-api/transfers + /api-reference/authorization-signatures):
 *
 * Privy's transfer API is called as:
 *   POST https://api.privy.io/v1/wallets/<wallet_id>/rpc?include=steps
 *   Authorization: Basic base64(<app_id>:<app_secret>)          ← server adds this
 *   privy-app-id: <app_id>                                      ← server adds this
 *   privy-authorization-signature: <sig>                        ← CLIENT generates via
 *                                                                  useAuthorizationSignature()
 *   privy-idempotency-key: <uuid>                               ← CLIENT generates, prevents
 *                                                                  double-sends on retry/race
 *
 * The privy-authorization-signature is an ECDSA signature of the canonical request
 * (version, method, url, body) using the USER's authorization key — a key that lives
 * in their browser session and was generated when they first used Privy. Privy verifies
 * this signature server-side against the key they enrolled for this user.
 *
 * This means:
 *   - The app secret alone CANNOT authorize a user transfer (custodial risk eliminated).
 *   - The user's browser session MUST sign the exact request before it leaves the client.
 *   - Our server route is a thin forwarder: it adds Basic auth (app-id:secret) and
 *     attaches the user-provided authorization-signature header. It never fabricates
 *     the signature; it only holds the app secret so it never hits the browser.
 *
 * IDEMPOTENCY:
 *   The client generates a UUID per-submit and includes it as `idempotencyKey` in the
 *   request body AND as the `privy-idempotency-key` header. This prevents double-sends
 *   from double-clicks or connection retries. The UUID is part of the signed body so it
 *   cannot be swapped in transit.
 *
 * Flow:
 *   1. Client builds the canonical transfer request body (buildTransferBody) including a
 *      fresh idempotencyKey (crypto.randomUUID).
 *   2. Client calls useAuthorizationSignature().generateAuthorizationSignature with
 *      { version: 1, method: "POST", url: <privy_url>, body, headers: { privy-app-id } }.
 *   3. Client POSTs { walletId, body, authorizationSignature, idempotencyKey } to /api/wallet/transfer.
 *   4. Server route attaches Basic auth + privy-app-id + privy-authorization-signature +
 *      privy-idempotency-key and proxies to api.privy.io.
 *
 * RESPONSE SHAPE (TransferActionResponse from @privy-io/api-types):
 *   {
 *     id: string,
 *     status: "pending" | "succeeded" | "rejected" | "failed",
 *     type: "transfer",
 *     // ... other top-level fields ...
 *     steps?: Array<WalletActionStep>   // only present when ?include=steps is appended
 *   }
 *
 *   WalletActionStep is one of:
 *     - EvmTransactionWalletActionStep  { type: "evm_transaction",    transaction_hash: string | null, ... }
 *     - EvmUserOperationWalletActionStep{ type: "evm_user_operation", bundle_transaction_hash: string | null, ... }
 *     - ExternalTransactionWalletActionStep (no hash field)
 *
 *   For user-pays-gas (ERC-4337) transfers, the step type is "evm_user_operation" and
 *   the hash is in bundle_transaction_hash, not transaction_hash.
 *   The route appends ?include=steps and extracts both fields.
 *
 * USER-PAYS GAS:
 *   When the Privy dashboard "user pays gas" toggle is enabled for a chain/token pair,
 *   Privy automatically routes the transfer through an ERC-4337 user operation using
 *   a paymaster that deducts the gas cost from the transferred token (USDC/USDT).
 *   The caller sends the same request body — no special field needed. The dashboard
 *   toggle is the only switch. Result: no ETH required in the user's wallet.
 */

import { z } from "zod";

// ─── Canonical Privy Wallet API base URL ─────────────────────────────────────

export const PRIVY_API_BASE = "https://api.privy.io/v1";

// ─── Supported transfer tokens ───────────────────────────────────────────────

export const TRANSFER_TOKENS = ["usdc", "usdt"] as const;
export type TransferToken = (typeof TRANSFER_TOKENS)[number];

export const TRANSFER_CHAINS = ["ethereum"] as const;
export type TransferChain = (typeof TRANSFER_CHAINS)[number];

// ─── Request body builder ─────────────────────────────────────────────────────

export interface TransferBody {
  source: {
    asset: TransferToken;
    amount: string;
    chain: TransferChain;
  };
  destination: {
    address: string;
  };
  /** Client-generated UUID included in the signed body for idempotency.
   *  Forwarded as the `privy-idempotency-key` header on the upstream request.
   *  Prevents duplicate sends from double-clicks or retries. */
  idempotencyKey: string;
}

/**
 * Build the JSON body for the Privy transfer RPC request.
 * Returns exactly what will be sent (and signed by the authorization signature).
 *
 * @param asset           "usdc" | "usdt"
 * @param amount          Human-readable decimal string, e.g. "10.5"
 * @param to              Recipient 0x address
 * @param idempotencyKey  Client-generated UUID (crypto.randomUUID()) — must be part
 *                        of the signed body to prevent replay/double-send.
 * @param chain           "ethereum" (only supported chain for user-pays gas with USDC/USDT)
 */
export function buildTransferBody(
  asset: TransferToken,
  amount: string,
  to: string,
  idempotencyKey: string,
  chain: TransferChain = "ethereum",
): TransferBody {
  return {
    source: { asset, amount, chain },
    destination: { address: to },
    idempotencyKey,
  };
}

/**
 * Returns the Privy Wallet API URL for a transfer against a specific wallet,
 * with ?include=steps so the response contains per-step transaction hashes.
 *
 * This URL is used both for the actual request AND as the canonical URL in the
 * authorization signature payload — they must be identical.
 */
export function buildTransferUrl(walletId: string): string {
  return `${PRIVY_API_BASE}/wallets/${walletId}/rpc?include=steps`;
}

// ─── Zod schemas for the /api/wallet/transfer route ──────────────────────────

/**
 * Ethereum address (0x + 40 hex chars). Client-side validation reuses zAddress
 * from lib/api/validate.ts; this copy is usable in both client and server contexts.
 */
export const zTransferAddress = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/, "must be a 0x-prefixed 40-char hex address");

/**
 * Decimal amount string: digits and at most one decimal point.
 * Max 30 chars (no USDC amount in human form needs more).
 */
export const zDecimalAmount = z
  .string()
  .min(1)
  .max(30)
  .regex(/^\d+(\.\d+)?$/, "must be a decimal number string");

/**
 * Request payload the client POSTs to /api/wallet/transfer.
 *
 * walletId         — Privy embedded wallet ID (e.g. "otwlt_..."), resolved client-side
 *                    from user.linkedAccounts
 * token            — "usdc" | "usdt"
 * amount           — human-readable decimal, e.g. "10.5"
 * to               — recipient address
 * authorizationSignature — base64 sig generated by useAuthorizationSignature(),
 *                    forwarded verbatim to the privy-authorization-signature header
 * idempotencyKey   — UUID generated by the client and included in the signed body;
 *                    forwarded as privy-idempotency-key header to prevent double-sends
 */
export const TransferRouteSchema = z.object({
  walletId: z.string().min(1).max(200),
  token: z.enum(TRANSFER_TOKENS),
  amount: zDecimalAmount,
  to: zTransferAddress,
  authorizationSignature: z.string().min(1).max(2000),
  idempotencyKey: z.string().uuid("idempotencyKey must be a UUID"),
});
export type TransferRouteInput = z.infer<typeof TransferRouteSchema>;

// ─── Response from /api/wallet/transfer ──────────────────────────────────────

export interface TransferRouteSuccess {
  actionId: string;
  status: string;
  /** Transaction hash — present once the step is submitted on-chain.
   *  Extracted from steps[].transaction_hash (evm_transaction) or
   *  steps[].bundle_transaction_hash (evm_user_operation / ERC-4337 paymaster path). */
  txHash: string | null;
}

export interface TransferRouteError {
  error: string;
}

export type TransferRouteResponse = TransferRouteSuccess | TransferRouteError;
