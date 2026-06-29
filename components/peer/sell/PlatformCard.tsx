"use client";

/**
 * components/peer/sell/PlatformCard.tsx
 *
 * Collapsible card for a single payment platform entry: payment ID input,
 * fiat currency chip selector, per-currency rate inputs with market spread.
 */

import React from "react";

import { PEER_FIAT_CURRENCIES } from "@/lib/peer/config";
import { peerMedianRate, usePeerOrderbook } from "@/lib/peer/quotes";
import { PlatformIcon, techLabel } from "./primitives";
import type { PlatformEntry } from "./types";

// ─── helpers (module-local) ───────────────────────────────────────────────────

function sanitizeDecimal(raw: string): string {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length <= 2) return cleaned;
  return `${parts[0]}.${parts.slice(1).join("")}`;
}

function rateSpread(rate: string, marketRate: number | null): string {
  const r = Number(rate);
  if (!Number.isFinite(r) || r <= 0) return "—";
  if (!marketRate || marketRate <= 0) return "—";
  const pct = (r / marketRate - 1) * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
}

// ─── PlatformCard ─────────────────────────────────────────────────────────────

export function PlatformCard({
  entry,
  onUpdate,
  onRemove,
}: {
  entry: PlatformEntry;
  onUpdate: (updated: PlatformEntry) => void;
  onRemove: () => void;
}) {
  const { platform, offchainId, currencies, rates, expanded } = entry;

  // Fetch orderbook for rate display (uses first currency for now; each currency
  // could be fetched independently — this is a UI convenience, rates are per-
  // platform-entry and already per-currency via the rates map).
  const firstCurrency = currencies[0]?.code ?? platform.currencies[0] ?? "USD";
  const ob = usePeerOrderbook(firstCurrency, platform.key);
  const marketRate = peerMedianRate(ob.data?.entries);
  const bookBest = marketRate != null ? marketRate.toFixed(4) : null;

  // Per-currency rate: auto-set from market when currency is added, only if not
  // already set. Each currency has an independent rate in the rates map.
  function getRate(code: string): string {
    if (rates[code] !== undefined) return rates[code];
    if (marketRate != null && marketRate > 0) return marketRate.toFixed(4);
    return "1.0000";
  }

  function setRate(code: string, val: string) {
    onUpdate({ ...entry, rates: { ...rates, [code]: sanitizeDecimal(val) } });
  }

  function toggleCurrency(fiat: (typeof PEER_FIAT_CURRENCIES)[number]) {
    const already = currencies.some((c) => c.code === fiat.code);
    if (already) {
      if (currencies.length <= 1) return; // always keep at least one
      const next = currencies.filter((c) => c.code !== fiat.code);
      const nextRates = { ...rates };
      delete nextRates[fiat.code];
      onUpdate({ ...entry, currencies: next, rates: nextRates });
    } else {
      const nextRate =
        rates[fiat.code] ??
        (marketRate != null && marketRate > 0 ? marketRate.toFixed(4) : "1.0000");
      onUpdate({
        ...entry,
        currencies: [...currencies, fiat],
        rates: { ...rates, [fiat.code]: nextRate },
      });
    }
  }

  const availableCurrencies = PEER_FIAT_CURRENCIES.filter((f) =>
    platform.currencies.includes(f.code),
  );

  const needsSetup = platform.needsTakerRegistration;

  return (
    <div
      style={{
        border: "1.5px solid var(--line)",
        borderRadius: 14,
        background: "#fff",
        overflow: "hidden",
        marginBottom: 8,
      }}
    >
      {/* card header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 14px",
        }}
      >
        {/* toggle region — wraps icon + name + chevron */}
        <button
          type="button"
          onClick={() => onUpdate({ ...entry, expanded: !expanded })}
          aria-expanded={expanded}
          aria-label={`Toggle ${platform.displayName}`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flex: 1,
            minWidth: 0,
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
            textAlign: "left",
          }}
        >
          <PlatformIcon platform={platform} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", lineHeight: 1.2 }}>
              {platform.displayName}
            </div>
            {needsSetup && !offchainId && (
              <div
                style={{
                  display: "inline-block",
                  fontSize: 10,
                  fontWeight: 700,
                  fontFamily: "var(--f-tech)",
                  letterSpacing: ".08em",
                  background: "var(--bg-tint)",
                  color: "var(--brand)",
                  border: "1px solid rgba(37,99,235,.2)",
                  borderRadius: 999,
                  padding: "1px 7px",
                  marginTop: 3,
                }}
              >
                Account needed
              </div>
            )}
            {offchainId && (
              <div style={{ fontSize: 11, color: "var(--muted-2)", marginTop: 1 }}>
                {offchainId}
              </div>
            )}
          </div>
          {/* chevron */}
          <span style={{ fontSize: 11, color: "var(--muted-2)", flexShrink: 0 }}>
            {expanded ? "▲" : "▼"}
          </span>
        </button>

        {/* remove */}
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${platform.displayName}`}
          style={{
            width: 24,
            height: 24,
            borderRadius: "50%",
            border: "1px solid var(--line)",
            background: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--muted-2)",
            fontSize: 14,
            flexShrink: 0,
          }}
        >
          ×
        </button>
      </div>

      {/* expanded body */}
      {expanded && (
        <div
          style={{
            padding: "0 14px 14px",
            borderTop: "1px solid var(--line)",
            paddingTop: 12,
          }}
        >
          {/* payment ID */}
          <div style={{ marginBottom: 12 }}>
            {techLabel(`Your ${platform.displayName} ${platform.offchainIdHint ? "ID" : "handle"}`)}
            <input
              type="text"
              value={offchainId}
              onChange={(e) => onUpdate({ ...entry, offchainId: e.target.value })}
              placeholder={platform.offchainIdHint}
              aria-label={`${platform.displayName} payment ID`}
              style={{
                width: "100%",
                border: "1px solid var(--line)",
                borderRadius: 10,
                padding: "9px 12px",
                fontSize: 13,
                color: "var(--ink)",
                background: "var(--bg-soft)",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* fiat currency chips */}
          <div style={{ marginBottom: 12 }}>
            {techLabel("Fiat currencies", {
              right: (
                <span
                  style={{
                    fontSize: 10,
                    color: "var(--muted-2)",
                    textTransform: "none",
                    letterSpacing: 0,
                  }}
                >
                  + Add
                </span>
              ),
            })}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {availableCurrencies.map((f) => {
                const active = currencies.some((c) => c.code === f.code);
                return (
                  <button
                    key={f.code}
                    type="button"
                    onClick={() => toggleCurrency(f)}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 8,
                      border: active ? "1.5px solid var(--brand)" : "1.5px solid var(--line)",
                      background: active ? "var(--bg-tint)" : "#fff",
                      color: active ? "var(--brand)" : "var(--muted)",
                      fontFamily: "var(--f-tech)",
                      fontSize: 11,
                      fontWeight: active ? 700 : 500,
                      cursor: "pointer",
                      transition: ".12s",
                    }}
                  >
                    <span style={{ marginRight: 4 }}>{f.flag}</span>
                    {f.code}
                  </button>
                );
              })}
            </div>
          </div>

          {/* per-currency rates */}
          {currencies.map((fiat) => {
            const r = getRate(fiat.code);
            const spread = rateSpread(r, marketRate);
            return (
              <div key={fiat.code} style={{ marginBottom: 8 }}>
                {techLabel(`Rate · ${fiat.code} per 1 USDC`, {
                  right: bookBest ? (
                    <span
                      style={{
                        fontSize: 9,
                        color: "var(--muted-2)",
                        textTransform: "none",
                        letterSpacing: 0,
                      }}
                    >
                      Book: {bookBest}
                    </span>
                  ) : undefined,
                })}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    border: "1px solid var(--line)",
                    borderRadius: 10,
                    padding: "8px 12px",
                    background: "var(--bg-soft)",
                  }}
                >
                  <input
                    type="text"
                    inputMode="decimal"
                    value={r}
                    onChange={(e) => setRate(fiat.code, e.target.value)}
                    aria-label={`${fiat.code} rate per USDC`}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      border: 0,
                      background: "none",
                      fontFamily: "var(--f-display)",
                      fontWeight: 800,
                      fontSize: 18,
                      color: "var(--ink)",
                      outline: "none",
                    }}
                  />
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: marketRate && Number(r) >= marketRate ? "var(--yes)" : "var(--no)",
                      flexShrink: 0,
                    }}
                  >
                    {spread}
                  </span>
                </div>
              </div>
            );
          })}

          {/* vault managed rates note */}
          <div
            style={{
              fontSize: 11,
              color: "var(--muted-2)",
              marginTop: 6,
              lineHeight: 1.5,
            }}
          >
            Vault will manage rates if delegation is active.
          </div>
        </div>
      )}
    </div>
  );
}
