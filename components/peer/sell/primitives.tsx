"use client";

/**
 * components/peer/sell/primitives.tsx
 *
 * Shared UI primitives for the SellPanel module:
 *   techLabel, Toggle, SectionLabel, PlatformIcon, RealMoneyNotice, SummaryRow
 */

import type React from "react";

import { cn } from "@/lib/cn";
import type { PeerPaymentPlatform } from "@/lib/peer/config";

// ─── techLabel ────────────────────────────────────────────────────────────────

export const techLabel = (
  text: string,
  opts?: { right?: React.ReactNode; style?: React.CSSProperties },
) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      fontFamily: "var(--f-tech)",
      fontSize: 10,
      letterSpacing: ".14em",
      textTransform: "uppercase" as const,
      color: "var(--muted-2)",
      marginBottom: 8,
      ...opts?.style,
    }}
  >
    <span>{text}</span>
    {opts?.right}
  </div>
);

// ─── Toggle ───────────────────────────────────────────────────────────────────

export function Toggle({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      aria-checked={enabled}
      role="switch"
      onClick={() => onChange(!enabled)}
      style={{
        width: 36,
        height: 20,
        borderRadius: 10,
        border: "none",
        background: enabled ? "var(--brand)" : "var(--line-2)",
        position: "relative",
        cursor: "pointer",
        transition: "background .15s",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 3,
          left: enabled ? 19 : 3,
          width: 14,
          height: 14,
          borderRadius: "50%",
          background: "#fff",
          transition: "left .15s",
          display: "block",
        }}
      />
    </button>
  );
}

// ─── SectionLabel ─────────────────────────────────────────────────────────────

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: "var(--f-tech)",
        fontSize: 10,
        letterSpacing: ".14em",
        textTransform: "uppercase" as const,
        color: "var(--muted-2)",
        marginBottom: 10,
      }}
    >
      {children}
    </div>
  );
}

// ─── PlatformIcon ─────────────────────────────────────────────────────────────

export function PlatformIcon({ platform }: { platform: PeerPaymentPlatform }) {
  const initials = platform.displayName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const colors: Record<string, string> = {
    wise: "#2CA85D",
    revolut: "#0666EB",
    venmo: "#008CFF",
    cashapp: "#00D64F",
    paypal: "#003087",
    zelle: "#6D1ED4",
    monzo: "#FF4F40",
    mercadopago: "#009EE3",
    chime: "#00BE33",
    n26: "#1E1E1E",
  };
  const bg = colors[platform.key] ?? "var(--brand)";
  return (
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        background: bg,
        color: "#fff",
        fontFamily: "var(--f-tech)",
        fontWeight: 700,
        fontSize: 11,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        letterSpacing: ".04em",
      }}
    >
      {initials}
    </div>
  );
}

// ─── RealMoneyNotice ──────────────────────────────────────────────────────────

export function RealMoneyNotice() {
  return (
    <div className="regnote" style={{ marginBottom: 0 }}>
      <div style={{ marginBottom: 5 }}>
        <span
          style={{
            fontFamily: "var(--f-tech)",
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: ".12em",
            textTransform: "uppercase",
            color: "var(--no)",
            background: "var(--no-soft)",
            border: "1px solid rgba(240,67,106,.22)",
            borderRadius: 999,
            padding: "2px 8px",
          }}
        >
          Real money
        </span>
      </div>
      <p style={{ margin: 0, fontSize: 12, lineHeight: 1.6, color: "var(--ink-2)" }}>
        Your USDC is escrowed on <strong style={{ color: "var(--ink)" }}>Base mainnet</strong> and
        released only when a buyer proves fiat payment to your account.
      </p>
    </div>
  );
}

// ─── SummaryRow ───────────────────────────────────────────────────────────────

export function SummaryRow({
  label,
  value,
  green = false,
}: {
  label: string;
  value: string;
  green?: boolean;
}) {
  return (
    <div className="r">
      <span className="k">{label}</span>
      <span className={cn("v price", green && "good")}>{value}</span>
    </div>
  );
}
