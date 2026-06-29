"use client";

/**
 * BuyPanel — fiat → USDC via the 0.5.0 on-ramp flow.
 *
 * State machine (owned by useOnramp in lib/peer/onramp.ts):
 *   quoting → signaling → awaiting_payment → capturing → fulfilling → success
 *                                                                    → error | expired
 *
 * Extension constraint (REAL, from SDK docs):
 *   The P2P proving extension only runs on desktop Chrome. Mobile and
 *   non-Chrome browsers cannot complete the payment proof step. This is not
 *   a protocol constraint — it is a protocol constraint of the TEE capture path.
 *
 * No fake successes. success state only fires after fulfillIntent tx receipt.
 */

import React from "react";

import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import {
  PEER_FIAT_CURRENCIES,
  type PeerFiatCurrency,
  type PeerPaymentPlatform,
  platformsForCurrency,
} from "@/lib/peer/config";
import { PEER_EXTENSION_CHROME_URL, usePeerExtension } from "@/lib/peer/extension";
import { useOnramp } from "@/lib/peer/onramp";
import { usePeerQuotes } from "@/lib/peer/quotes";
import type { QuoteSingleResponse } from "@zkp2p/sdk";
import { useAccount } from "wagmi";

// ─── helpers ─────────────────────────────────────────────────────────────────

function sanitizeDecimal(raw: string): string {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length <= 2) return cleaned;
  return `${parts[0]}.${parts.slice(1).join("")}`;
}

function isMobileOrNonChrome(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent ?? "";
  const isMobile = /Android|iPhone|iPad|iPod/i.test(ua);
  const isChrome = /Chrome\//.test(ua) && !/Edg\/|OPR\/|Brave\//.test(ua);
  return isMobile || !isChrome;
}

// ─── sub-components ───────────────────────────────────────────────────────────

function CurrencyDropdown({
  value,
  onChange,
  disabled,
}: {
  value: PeerFiatCurrency;
  onChange: (c: PeerFiatCurrency) => void;
  disabled?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {PEER_FIAT_CURRENCIES.map((c) => (
        <button
          key={c.code}
          type="button"
          onClick={() => onChange(c)}
          disabled={disabled}
          className={cn("rtab", c.code === value.code && "on")}
          style={{ padding: "6px 12px", fontSize: 12 }}
        >
          <span style={{ marginRight: 4 }}>{c.flag}</span>
          {c.code}
        </button>
      ))}
    </div>
  );
}

function PlatformChip({
  platform,
  active,
  onClick,
}: {
  platform: PeerPaymentPlatform;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("rtab", active && "on")}
      style={{ padding: "6px 12px", fontSize: 12 }}
    >
      {platform.displayName}
    </button>
  );
}

function StepBadge({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      style={{
        fontFamily: "var(--f-tech)",
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: ".1em",
        textTransform: "uppercase" as const,
        color: active ? "var(--yes)" : "var(--muted-2)",
        background: active ? "rgba(19,185,129,.12)" : "var(--bg-tint)",
        borderRadius: 999,
        padding: "2px 8px",
        border: active ? "1px solid rgba(19,185,129,.22)" : "1px solid var(--line)",
        whiteSpace: "nowrap" as const,
      }}
    >
      {label}
    </span>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export function BuyPanel() {
  const { address } = useAccount();

  const [fiat, setFiat] = React.useState<PeerFiatCurrency>(
    () => PEER_FIAT_CURRENCIES[0] ?? { code: "USD", symbol: "$", flag: "🇺🇸", name: "US Dollar" },
  );
  const [amount, setAmount] = React.useState("100");
  const [activePlatformKey, setActivePlatformKey] = React.useState<string | null>(null);

  const ext = usePeerExtension();
  const onramp = useOnramp();
  const platforms = platformsForCurrency(fiat.code);

  React.useEffect(() => {
    if (!platforms.find((p) => p.key === activePlatformKey)) {
      setActivePlatformKey(platforms[0]?.key ?? null);
    }
  }, [platforms, activePlatformKey]);

  const quotes = usePeerQuotes({
    fiatCurrency: fiat.code,
    amount,
    isExactFiat: true,
    user: address ?? null,
    recipient: address ?? null,
  });

  const onMobile = isMobileOrNonChrome();
  const isActive = !["idle", "success", "error", "expired"].includes(onramp.state.step);
  const platformQuotes = quotes.data?.responseObject.platformQuotes ?? [];

  // Best quote for the selected platform.
  const selectedQuote: QuoteSingleResponse | null = React.useMemo(() => {
    if (!activePlatformKey) return null;
    const pq = platformQuotes.find(
      (q) => q.platform === activePlatformKey && q.available && q.bestQuote,
    );
    return pq?.bestQuote ?? null;
  }, [platformQuotes, activePlatformKey]);

  const fieldLabel = (text: string) => (
    <div
      style={{
        fontFamily: "var(--f-tech)",
        fontSize: 10,
        letterSpacing: ".14em",
        textTransform: "uppercase" as const,
        color: "var(--muted-2)",
        marginBottom: 8,
      }}
    >
      {text}
    </div>
  );

  // ── handlers ──────────────────────────────────────────────────────────────

  function handleSignal() {
    if (!selectedQuote) {
      toast.error({
        title: "No quote available",
        description: "Pick a platform with an active offer.",
      });
      return;
    }
    onramp.signal(selectedQuote, amount);
  }

  function handleConnectExt() {
    ext.connect().catch(() => {});
  }

  function handleInstallExt() {
    ext.openInstall();
  }

  function handleCaptureAndFulfill() {
    if (ext.state === "needs_install") {
      ext.openInstall();
      return;
    }
    if (ext.state === "needs_connection") {
      ext.connect().catch(() => {});
      return;
    }
    onramp.captureAndFulfill();
    toast.info({
      title: "Opening P2P proving extension",
      description:
        "The extension will open a provider tab. Complete the payment proof there, then return here.",
      ttlMs: 8000,
    });
  }

  function handleCancel() {
    onramp.cancel().catch(() => {});
  }

  // ── step-aware CTA ────────────────────────────────────────────────────────

  const step = onramp.state.step;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Mobile / non-Chrome notice */}
      {onMobile && (
        <div
          className="regnote"
          style={{
            background: "var(--bg-soft)",
            borderColor: "var(--line-2)",
            color: "var(--muted)",
          }}
        >
          <span style={{ fontWeight: 700, color: "var(--ink)" }}>Desktop Chrome required.</span> The
          P2P payment proof runs in a desktop Chrome extension. Open this app on desktop Chrome to
          buy.
        </div>
      )}

      {/* ── SUCCESS ─────────────────────────────────────────────────── */}
      {step === "success" && (
        <div
          style={{
            borderRadius: 12,
            padding: "14px 16px",
            background: "var(--yes-soft)",
            border: "1px solid rgba(19,185,129,.3)",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <div style={{ fontWeight: 700, color: "var(--yes)", fontSize: 14 }}>USDC received</div>
          <div style={{ fontSize: 12, color: "var(--ink-2)" }}>
            Your USDC has been released from escrow and sent to your wallet.
          </div>
          {onramp.state.txHash && (
            <a
              href={`https://basescan.org/tx/${onramp.state.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 11, color: "var(--brand)" }}
            >
              View on Basescan
            </a>
          )}
          <button
            type="button"
            className="rtab on"
            style={{ marginTop: 6, padding: "6px 14px", fontSize: 12, width: "fit-content" }}
            onClick={onramp.reset}
          >
            Buy again
          </button>
        </div>
      )}

      {/* ── ERROR / EXPIRED ─────────────────────────────────────────── */}
      {(step === "error" || step === "expired") && (
        <div
          style={{
            borderRadius: 12,
            padding: "14px 16px",
            background: "var(--no-soft, rgba(239,68,68,.08))",
            border: "1px solid rgba(239,68,68,.25)",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <div style={{ fontWeight: 700, color: "var(--no)", fontSize: 13 }}>
            {step === "expired" ? "Intent expired" : "Error"}
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-2)" }}>{onramp.state.error}</div>
          <button
            type="button"
            className="rtab"
            style={{ marginTop: 6, padding: "6px 14px", fontSize: 12, width: "fit-content" }}
            onClick={onramp.reset}
          >
            Try again
          </button>
        </div>
      )}

      {/* ── AWAITING PAYMENT instructions ───────────────────────────── */}
      {step === "awaiting_payment" && (
        <div
          style={{
            borderRadius: 12,
            padding: "14px 16px",
            background: "var(--bg-tint)",
            border: "1px solid var(--line-2)",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div style={{ fontWeight: 700, color: "var(--ink)", fontSize: 13 }}>
            Step 2 · Pay the maker
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-2)", lineHeight: 1.6 }}>
            Send{" "}
            <strong>
              {fiat.symbol}
              {onramp.state.fiatAmount}
            </strong>{" "}
            to <strong>{onramp.state.payeeTo}</strong> via{" "}
            <strong style={{ textTransform: "capitalize" }}>{onramp.state.platform}</strong>. Then
            come back here and click "Prove payment".
          </div>
          <div style={{ fontSize: 11, color: "var(--muted-2)" }}>
            Intent locked: {onramp.state.intentHash?.slice(0, 18)}…
          </div>
        </div>
      )}

      {/* ── Step progress chips ──────────────────────────────────────── */}
      {isActive && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const, alignItems: "center" }}>
          <StepBadge label="Signal" active={step === "signaling"} />
          <StepBadge label="Pay" active={step === "awaiting_payment"} />
          <StepBadge label="Prove" active={step === "capturing"} />
          <StepBadge label="Fulfill" active={step === "fulfilling"} />
        </div>
      )}

      {/* ── Quote inputs (disabled while active) ────────────────────── */}
      {(step === "idle" || step === "error" || step === "expired") && (
        <>
          {/* Amount + currency */}
          <div className="panel">
            <div className="pl">
              <span>You send</span>
            </div>
            <div className="prow">
              <span style={{ fontSize: 18, color: "var(--muted)", fontWeight: 600 }}>
                {fiat.symbol}
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(sanitizeDecimal(e.target.value))}
                placeholder="0.00"
                aria-label="Amount to send"
              />
              <button
                type="button"
                className="tokbtn"
                style={{ cursor: "default", pointerEvents: "none" }}
              >
                {fiat.code}
              </button>
            </div>
          </div>

          {/* Currency picker */}
          <div>
            {fieldLabel("Currency")}
            <CurrencyDropdown value={fiat} onChange={setFiat} />
          </div>

          {/* Platform filter */}
          {platforms.length > 0 && (
            <div>
              {fieldLabel("Paying via")}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {platforms.map((p) => (
                  <PlatformChip
                    key={p.key}
                    platform={p}
                    active={activePlatformKey === p.key}
                    onClick={() => setActivePlatformKey(p.key)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* You receive */}
          <div className="panel">
            <div className="pl">
              <span>You receive (on Ethereum)</span>
            </div>
            {quotes.isLoading ? (
              <div
                style={{
                  height: 36,
                  width: 120,
                  borderRadius: 8,
                  background: "var(--bg-tint)",
                  animation: "pulse 1.4s ease-in-out infinite",
                }}
              />
            ) : quotes.isError ? (
              <span style={{ fontSize: 13, color: "var(--no)" }}>Quote unavailable</span>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {platformQuotes.length === 0 ? (
                  <span style={{ fontSize: 13, color: "var(--muted)" }}>
                    No quotes for {fiat.code} right now
                  </span>
                ) : (
                  platformQuotes
                    .filter((q) => q.available && q.bestQuote)
                    .filter((q) => activePlatformKey === null || q.platform === activePlatformKey)
                    .slice(0, 4)
                    .map((q) => {
                      const best = q.bestQuote;
                      if (!best) return null;
                      const isTop =
                        platformQuotes
                          .filter((pq) => pq.available && pq.bestQuote)
                          .sort((a, b) => {
                            const aAmt = Number(a.bestQuote?.tokenAmount ?? "0");
                            const bAmt = Number(b.bestQuote?.tokenAmount ?? "0");
                            return bAmt - aAmt;
                          })[0]?.platform === q.platform;
                      return (
                        <div
                          key={q.platform}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            borderRadius: 10,
                            padding: "9px 12px",
                            background: isTop ? "var(--yes-soft)" : "var(--bg-tint)",
                            border: isTop
                              ? "1px solid rgba(19,185,129,.22)"
                              : "1px solid var(--line)",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-2)" }}>
                              {q.platform}
                            </span>
                            {isTop && (
                              <span
                                style={{
                                  fontFamily: "var(--f-tech)",
                                  fontSize: 9,
                                  fontWeight: 700,
                                  letterSpacing: ".1em",
                                  textTransform: "uppercase",
                                  color: "var(--yes)",
                                  background: "rgba(19,185,129,.12)",
                                  borderRadius: 999,
                                  padding: "2px 7px",
                                }}
                              >
                                best
                              </span>
                            )}
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div
                              className="price"
                              style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}
                            >
                              {Number(best.tokenAmountFormatted).toFixed(2)} USDC
                            </div>
                            <div
                              className="price"
                              style={{ fontSize: 10, color: "var(--muted-2)" }}
                            >
                              @ {Number(best.conversionRate).toFixed(4)}
                            </div>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            )}
          </div>

          {/* Step 1 CTA — only when idle on desktop */}
          {!onMobile && (
            <button
              type="button"
              className="cta"
              onClick={handleSignal}
              disabled={!selectedQuote || !address}
            >
              {!address
                ? "Connect wallet to buy"
                : !selectedQuote
                  ? "No quote available"
                  : `Buy ${fiat.symbol}${amount} → USDC via ${
                      platforms.find((p) => p.key === activePlatformKey)?.displayName ??
                      activePlatformKey ??
                      "…"
                    }`}
            </button>
          )}

          {onMobile && (
            <p
              className="cta"
              style={{ display: "block", textAlign: "center", opacity: 0.75, cursor: "default" }}
            >
              Buying needs the desktop proving extension. Open this app on desktop Chrome.
            </p>
          )}
        </>
      )}

      {/* ── Step 2 CTA: prove payment (awaiting_payment) ────────────── */}
      {step === "awaiting_payment" && !onMobile && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button
            type="button"
            className="cta"
            onClick={handleCaptureAndFulfill}
            disabled={ext.state === "checking"}
          >
            {ext.state === "needs_install"
              ? "Install proving extension to prove payment"
              : ext.state === "needs_connection"
                ? "Connect extension to prove payment"
                : "Prove payment (opens extension)"}
          </button>
          <button
            type="button"
            style={{
              background: "none",
              border: "1px solid var(--line)",
              borderRadius: 8,
              padding: "8px 12px",
              fontSize: 12,
              color: "var(--muted)",
              cursor: "pointer",
            }}
            onClick={handleCancel}
          >
            Cancel and unlock funds
          </button>
        </div>
      )}

      {/* ── Proving / fulfilling spinners ────────────────────────────── */}
      {(step === "capturing" || step === "fulfilling") && (
        <div
          style={{
            borderRadius: 12,
            padding: "14px 16px",
            background: "var(--bg-tint)",
            border: "1px solid var(--line)",
            fontSize: 13,
            color: "var(--ink-2)",
          }}
        >
          {step === "capturing"
            ? "Waiting for payment proof from extension…"
            : "Submitting fulfillment transaction…"}
        </div>
      )}

      {/* ── Extension install/connection prompts ─────────────────────── */}
      {ext.state === "needs_install" && !onMobile && step !== "success" && (
        <p
          style={{
            textAlign: "center",
            fontSize: 11,
            color: "var(--muted-2)",
            margin: 0,
          }}
        >
          Extension not installed.{" "}
          <button
            type="button"
            onClick={handleInstallExt}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              color: "var(--brand)",
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            Install from Chrome Web Store
          </button>
        </p>
      )}

      {ext.state === "needs_connection" && !onMobile && step !== "success" && (
        <p style={{ textAlign: "center", fontSize: 11, color: "var(--muted-2)", margin: 0 }}>
          Extension installed but not connected.{" "}
          <button
            type="button"
            onClick={handleConnectExt}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              color: "var(--brand)",
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            Connect
          </button>
        </p>
      )}

      {/* Chrome Web Store link when needs_install */}
      {ext.state === "needs_install" && !onMobile && (
        <p style={{ textAlign: "center", fontSize: 11, color: "var(--muted-2)", margin: 0 }}>
          <a
            href={PEER_EXTENSION_CHROME_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--brand)" }}
          >
            PeerAuth on Chrome Web Store
          </a>
        </p>
      )}

      {/* Footnote */}
      <p style={{ fontSize: 11, color: "var(--muted-2)", lineHeight: 1.55, margin: 0 }}>
        Payment proof runs in the PeerAuth extension (desktop Chrome). Your wallet signs the onchain
        settlement. The app never holds your keys.
      </p>
    </div>
  );
}
