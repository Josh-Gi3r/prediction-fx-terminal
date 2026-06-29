"use client";

/**
 * components/portfolio/SendModal.tsx
 *
 * Send stablecoins from the user's Privy embedded wallet.
 * Gas is paid in the transferred token (USDC/USDT) — no ETH needed.
 * Requires NEXT_PUBLIC_FEATURE_GASLESS_SEND=true and Privy dashboard
 * "user pays gas" enabled for Ethereum/USDC + Ethereum/USDT.
 *
 * AUTHORIZATION FLOW:
 *   1. User enters recipient + amount and clicks Confirm.
 *   2. useAuthorizationSignature().generateAuthorizationSignature() signs the
 *      exact Privy API request body client-side with the user's authorization key.
 *      This is a browser-session key enrolled during Privy onboarding. Only the
 *      user's session can produce this signature; the app server cannot.
 *   3. We POST { walletId, token, amount, to, authorizationSignature, idempotencyKey }
 *      to our /api/wallet/transfer route, which adds Basic auth (app-id:app-secret)
 *      and forwards to api.privy.io. The app secret never hits the browser.
 *   4. Privy verifies the authorization-signature against the user's enrolled key
 *      and executes the transfer via ERC-4337 user operation with paymaster.
 *
 * DOUBLE-SEND PREVENTION:
 *   - A submitting ref is set synchronously on click (before any await) so that
 *     concurrent clicks are ignored at the top of handleSend.
 *   - A per-submit UUID (idempotencyKey) is included in the signed body and forwarded
 *     as `privy-idempotency-key` to Privy, which deduplicates on their side.
 *
 * See: docs.privy.io/wallet-api/transfers
 *      docs.privy.io/api-reference/authorization-signatures
 */

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  TRANSFER_CHAINS,
  type TransferRouteSuccess,
  type TransferToken,
  buildTransferBody,
  buildTransferUrl,
} from "@/lib/privy/transfer";
import { useAuthorizationSignature, usePrivy } from "@privy-io/react-auth";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatUnits, parseUnits } from "viem";

// ─── Types ────────────────────────────────────────────────────────────────────

type SendState =
  | { phase: "idle" }
  | { phase: "submitting" }
  | { phase: "success"; txHash: string | null; actionId: string }
  | { phase: "error"; message: string };

interface SendModalProps {
  open: boolean;
  onClose: () => void;
  /** Token symbol as shown in the UI, e.g. "USDC" or "USDT". */
  tokenSymbol: string;
  /** Lowercase Privy asset identifier: "usdc" | "usdt". */
  token: TransferToken;
  /** Max available balance as a raw bigint (6-decimal stables). Preferred over maxBalance. */
  maxRaw?: bigint;
  /** Max available balance as a number (for the Max button). Used when maxRaw is not provided. */
  maxBalance: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const AMOUNT_RE = /^\d+(\.\d+)?$/;
/** Decimals for USDC / USDT. */
const TOKEN_DECIMALS = 6;

function isValidAddress(v: string): boolean {
  return ADDRESS_RE.test(v);
}

function isValidAmount(v: string, max: number): boolean {
  if (!AMOUNT_RE.test(v)) return false;
  const n = Number.parseFloat(v);
  return Number.isFinite(n) && n > 0 && n <= max;
}

/**
 * Derive the human-readable max string from raw bigint to avoid float precision
 * drift (P2-3). Uses viem's formatUnits which handles exact bigint → decimal
 * conversion, then strips trailing zeros.
 */
function rawToMaxString(raw: bigint): string {
  return formatUnits(raw, TOKEN_DECIMALS).replace(/\.?0+$/, "") || "0";
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SendModal({
  open,
  onClose,
  tokenSymbol,
  token,
  maxRaw,
  maxBalance,
}: SendModalProps) {
  const { user } = usePrivy();
  const { generateAuthorizationSignature } = useAuthorizationSignature();

  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [state, setState] = useState<SendState>({ phase: "idle" });

  // Synchronous submit guard — set true BEFORE any await to block concurrent clicks.
  // Using a ref (not state) so the check in handleSend reads the current value
  // synchronously without a render cycle.
  const submittingRef = useRef(false);

  // Reset form whenever the modal opens.
  useEffect(() => {
    if (open) {
      setTo("");
      setAmount("");
      setState({ phase: "idle" });
      submittingRef.current = false;
    }
  }, [open]);

  // Derive max as a stable number from raw bigint when available, else fall back
  // to the prop. This avoids stale closure issues: we always re-read props inside
  // the callback rather than capturing a potentially stale maxBalance.
  const effectiveMaxBalance =
    maxRaw !== undefined ? Number(formatUnits(maxRaw, TOKEN_DECIMALS)) : maxBalance;

  const toError = to && !isValidAddress(to) ? "Invalid Ethereum address" : null;
  const amountError =
    amount && !isValidAmount(amount, effectiveMaxBalance)
      ? Number.parseFloat(amount) > effectiveMaxBalance
        ? `Exceeds balance (${effectiveMaxBalance.toFixed(4)} ${tokenSymbol})`
        : "Enter a positive number"
      : null;

  const canSubmit =
    state.phase === "idle" &&
    isValidAddress(to) &&
    isValidAmount(amount, effectiveMaxBalance) &&
    !!user;

  // Resolve the Privy embedded wallet ID from user.linkedAccounts.
  // Privy embedded Ethereum wallets have type "wallet" and walletClientType "privy".
  const walletId: string | null = (() => {
    if (!user?.linkedAccounts) return null;
    for (const acct of user.linkedAccounts) {
      if (
        acct.type === "wallet" &&
        "walletClientType" in acct &&
        acct.walletClientType === "privy" &&
        "chainType" in acct &&
        acct.chainType === "ethereum" &&
        "walletIndex" in acct &&
        // The wallet ID is stored as `id` on the linked account object.
        "id" in acct
      ) {
        return (acct as unknown as { id: string }).id;
      }
    }
    return null;
  })();

  const handleSend = useCallback(async () => {
    // Synchronous guard: reject concurrent calls before any state update or await.
    if (submittingRef.current) return;
    if (!walletId) return;

    // Re-read current max from props directly to avoid stale closure on maxBalance.
    // This is safe because we're inside a useCallback — the enclosing scope's
    // maxBalance and maxRaw are the latest rendered values.
    const currentMax =
      maxRaw !== undefined ? Number(formatUnits(maxRaw, TOKEN_DECIMALS)) : maxBalance;

    if (!isValidAddress(to) || !isValidAmount(amount, currentMax) || !user) return;

    // Block synchronously BEFORE the first await. Any subsequent click within the
    // same event loop will see submittingRef.current === true and return early.
    submittingRef.current = true;
    setState({ phase: "submitting" });

    try {
      const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";
      const chain = TRANSFER_CHAINS[0]; // "ethereum"

      // Generate a per-submit UUID. Included in the signed body so it cannot be
      // swapped in transit. Also forwarded as privy-idempotency-key.
      const idempotencyKey = crypto.randomUUID();

      const body = buildTransferBody(token, amount.trim(), to.trim(), idempotencyKey, chain);
      const privyUrl = buildTransferUrl(walletId);

      // Step 1: Generate authorization signature client-side.
      // This signs the canonical request with the user's authorization key —
      // the key is scoped to this user's session; only they can produce this sig.
      const { signature: authorizationSignature } = await generateAuthorizationSignature({
        version: 1,
        method: "POST",
        url: privyUrl,
        body,
        headers: {
          "privy-app-id": appId,
        },
      });

      // Step 2: Forward to our server route (server adds Basic auth + app secret).
      const res = await fetch("/api/wallet/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletId,
          token,
          amount: amount.trim(),
          to: to.trim(),
          authorizationSignature,
          idempotencyKey,
        }),
      });

      const json = (await res.json()) as Record<string, unknown>;

      if (!res.ok) {
        const msg = typeof json.error === "string" ? json.error : `Send failed (${res.status})`;
        setState({ phase: "error", message: mapPrivyError(msg) });
        submittingRef.current = false;
        return;
      }

      const result = json as unknown as TransferRouteSuccess;
      setState({
        phase: "success",
        txHash: result.txHash ?? null,
        actionId: result.actionId,
      });
      // Leave submittingRef.current true — success state, modal should close.
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setState({ phase: "error", message: mapPrivyError(msg) });
      submittingRef.current = false;
    }
  }, [walletId, token, amount, to, generateAuthorizationSignature, user, maxBalance, maxRaw]);

  const isSubmitting = state.phase === "submitting";
  const isSuccess = state.phase === "success";
  const isError = state.phase === "error";

  // Max button: derive from raw bigint when available for exact representation,
  // otherwise fall back to the float prop (P2-3 fix).
  const handleMax = () => {
    if (maxRaw !== undefined) {
      setAmount(rawToMaxString(maxRaw));
    } else {
      setAmount(effectiveMaxBalance.toFixed(6).replace(/\.?0+$/, ""));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md" showClose={!isSubmitting}>
        <DialogHeader>
          <DialogTitle>Send {tokenSymbol}</DialogTitle>
        </DialogHeader>

        {isSuccess ? (
          <SuccessView
            txHash={state.phase === "success" ? state.txHash : null}
            tokenSymbol={tokenSymbol}
            amount={amount}
            to={to}
            onClose={onClose}
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 4 }}>
            {/* Recipient */}
            <div>
              <label
                htmlFor="send-to"
                style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 600,
                  marginBottom: 6,
                  color: "var(--muted)",
                }}
              >
                Recipient address
              </label>
              <input
                id="send-to"
                type="text"
                placeholder="0x..."
                value={to}
                onChange={(e) => setTo(e.target.value)}
                disabled={isSubmitting}
                style={inputStyle(!!toError)}
              />
              {toError && <div style={errorStyle}>{toError}</div>}
            </div>

            {/* Amount */}
            <div>
              <label
                htmlFor="send-amount"
                style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 600,
                  marginBottom: 6,
                  color: "var(--muted)",
                }}
              >
                Amount
              </label>
              <div style={{ position: "relative" }}>
                <input
                  id="send-amount"
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={isSubmitting}
                  style={{ ...inputStyle(!!amountError), paddingRight: 76 }}
                />
                <button
                  type="button"
                  onClick={handleMax}
                  disabled={isSubmitting || effectiveMaxBalance <= 0}
                  style={maxBtnStyle}
                >
                  Max
                </button>
              </div>
              {amountError && <div style={errorStyle}>{amountError}</div>}
            </div>

            {/* Fee note */}
            <div style={feeNoteStyle}>Network fee is paid in {tokenSymbol} — no ETH needed.</div>

            {/* Error banner */}
            {isError && (
              <div style={errorBannerStyle}>{state.phase === "error" ? state.message : ""}</div>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <DialogClose asChild>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={onClose}
                  style={cancelBtnStyle}
                >
                  Cancel
                </button>
              </DialogClose>
              <button
                type="button"
                disabled={!canSubmit || isSubmitting}
                onClick={handleSend}
                style={confirmBtnStyle(!canSubmit || isSubmitting)}
              >
                {isSubmitting ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        width: 14,
                        height: 14,
                        border: "2px solid rgba(255,255,255,0.4)",
                        borderTopColor: "#fff",
                        borderRadius: "50%",
                        animation: "spin 0.8s linear infinite",
                        display: "inline-block",
                      }}
                    />
                    Sending…
                  </span>
                ) : (
                  "Confirm send"
                )}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Success view ─────────────────────────────────────────────────────────────

function SuccessView({
  txHash,
  tokenSymbol,
  amount,
  to,
  onClose,
}: {
  txHash: string | null;
  tokenSymbol: string;
  amount: string;
  to: string;
  onClose: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 4 }}>
      <div style={successBannerStyle}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <circle cx="10" cy="10" r="9" stroke="var(--yes, #16a34a)" strokeWidth="1.5" />
          <path
            d="M6.5 10.5l2.5 2.5 5-5"
            stroke="var(--yes, #16a34a)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span>
          Sent {amount} {tokenSymbol} to {to.slice(0, 8)}…{to.slice(-4)}
        </span>
      </div>

      {txHash && (
        <a
          href={`https://etherscan.io/tx/${txHash}`}
          target="_blank"
          rel="noreferrer"
          style={{
            fontSize: 13,
            color: "var(--brand)",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          View on Etherscan ↗
        </a>
      )}

      {!txHash && (
        <p style={{ fontSize: 12, color: "var(--muted-2)", margin: 0 }}>
          Transaction submitted. It may take a few seconds to appear on-chain.
        </p>
      )}

      <button type="button" onClick={onClose} style={confirmBtnStyle(false)}>
        Done
      </button>
    </div>
  );
}

// ─── Error message mapping ────────────────────────────────────────────────────

function mapPrivyError(msg: string): string {
  const lower = msg.toLowerCase();
  if (lower.includes("insufficient") || lower.includes("balance")) {
    return "Insufficient balance to cover the transfer and gas fee.";
  }
  if (lower.includes("unauthorized") || lower.includes("403")) {
    return "Authorization failed. Please reconnect your wallet and try again.";
  }
  if (lower.includes("not configured") || lower.includes("503")) {
    return "Send is not available yet. Check back soon.";
  }
  if (lower.includes("upstream") || lower.includes("502") || lower.includes("fetch")) {
    return "Network error. Please try again.";
  }
  return msg;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function inputStyle(hasError: boolean): React.CSSProperties {
  return {
    width: "100%",
    padding: "10px 12px",
    fontSize: 14,
    fontFamily: "var(--f-tech, monospace)",
    background: "var(--bg-tint, #f7f9fc)",
    border: `1px solid ${hasError ? "var(--no, #f0436a)" : "var(--line, #e2e6f0)"}`,
    borderRadius: 10,
    outline: "none",
    color: "var(--ink)",
    boxSizing: "border-box" as const,
  };
}

const errorStyle: React.CSSProperties = {
  fontSize: 11,
  color: "var(--no, #f0436a)",
  marginTop: 4,
};

const maxBtnStyle: React.CSSProperties = {
  position: "absolute",
  right: 10,
  top: "50%",
  transform: "translateY(-50%)",
  background: "var(--bg-tint)",
  border: "1px solid var(--line)",
  borderRadius: 6,
  padding: "3px 8px",
  fontSize: 11,
  fontWeight: 700,
  color: "var(--brand)",
  cursor: "pointer",
};

const feeNoteStyle: React.CSSProperties = {
  fontSize: 12,
  color: "var(--muted-2, #8492a6)",
  background: "var(--bg-tint, #f7f9fc)",
  border: "1px solid var(--line, #e2e6f0)",
  borderRadius: 8,
  padding: "8px 12px",
  lineHeight: 1.5,
};

const errorBannerStyle: React.CSSProperties = {
  fontSize: 13,
  color: "var(--no, #f0436a)",
  background: "rgba(240,67,106,0.06)",
  border: "1px solid rgba(240,67,106,0.2)",
  borderRadius: 8,
  padding: "10px 12px",
};

const successBannerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  fontSize: 14,
  fontWeight: 600,
  color: "var(--yes-text, #15803d)",
  background: "rgba(22,163,74,0.07)",
  border: "1px solid rgba(22,163,74,0.2)",
  borderRadius: 10,
  padding: "12px 14px",
};

const cancelBtnStyle: React.CSSProperties = {
  flex: 1,
  padding: "11px 0",
  fontSize: 14,
  fontWeight: 600,
  background: "var(--bg-tint, #f7f9fc)",
  border: "1px solid var(--line, #e2e6f0)",
  borderRadius: 10,
  cursor: "pointer",
  color: "var(--muted)",
};

function confirmBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: "11px 0",
    fontSize: 14,
    fontWeight: 700,
    background: disabled ? "var(--bg-tint, #f0f4ff)" : "var(--brand, #2563eb)",
    color: disabled ? "var(--muted-2)" : "#fff",
    border: "none",
    borderRadius: 10,
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "background 0.15s",
  };
}

// React import for JSX + CSSProperties
import type React from "react";
