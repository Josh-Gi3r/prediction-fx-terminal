"use client";

/**
 * components/mobile/p2p/shared.tsx
 * Shared data, helpers, and micro-components used across P2P panels.
 */

import { PEER_PAYMENT_PLATFORMS } from "@/lib/peer/config";
import { peerMedianRate, usePeerOrderbook } from "@/lib/peer/quotes";

// ── Platform data ─────────────────────────────────────────────────────────────
export const CURRENCY_FLAGS: Record<string, string> = {
  USD: "🇺🇸",
  GBP: "🇬🇧",
  EUR: "🇪🇺",
  SGD: "🇸🇬",
  AUD: "🇦🇺",
  MYR: "🇲🇾",
  PHP: "🇵🇭",
  ARS: "🇦🇷",
  BRL: "🇧🇷",
  MXN: "🇲🇽",
};

export const PLAT_COLORS: Record<string, string> = {
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

export function platInitials(key: string): string {
  const p = PEER_PAYMENT_PLATFORMS.find((x) => x.key === key);
  if (!p) return key.slice(0, 1).toUpperCase();
  return p.displayName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function platDisplayName(key: string): string {
  return PEER_PAYMENT_PLATFORMS.find((x) => x.key === key)?.displayName ?? key;
}

export function fmt(n: number, d = 2): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: d });
}
export function fmtK(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return n.toFixed(0);
}
export function flag(code: string): string {
  return CURRENCY_FLAGS[code] ?? "🏳️";
}

// ── Live rates hook ────────────────────────────────────────────────────────────
export function useLiveRates(): {
  rates: Record<string, number | null>;
  loading: Record<string, boolean>;
} {
  const usd = usePeerOrderbook("USD");
  const gbp = usePeerOrderbook("GBP");
  const eur = usePeerOrderbook("EUR");
  const sgd = usePeerOrderbook("SGD");
  const aud = usePeerOrderbook("AUD");

  function bestMid(qr: ReturnType<typeof usePeerOrderbook>): {
    rate: number | null;
    loading: boolean;
  } {
    if (qr.isLoading) return { rate: null, loading: true };
    return { rate: peerMedianRate(qr.data?.entries), loading: false };
  }

  const results = {
    USD: bestMid(usd),
    GBP: bestMid(gbp),
    EUR: bestMid(eur),
    SGD: bestMid(sgd),
    AUD: bestMid(aud),
  };

  return {
    rates: Object.fromEntries(Object.entries(results).map(([k, v]) => [k, v.rate])),
    loading: Object.fromEntries(Object.entries(results).map(([k, v]) => [k, v.loading])),
  };
}

// ── Inline style helpers ───────────────────────────────────────────────────────
export const card: React.CSSProperties = {
  background: "#fff",
  border: "1px solid var(--line)",
  borderRadius: 14,
  boxShadow: "0 1px 4px rgba(11,20,55,.06)",
};

export const techLabel: React.CSSProperties = {
  fontFamily: "var(--f-tech)",
  fontSize: 9.5,
  fontWeight: 700,
  letterSpacing: ".12em",
  textTransform: "uppercase" as const,
  color: "var(--muted-2)",
  marginBottom: 5,
};

// ── Platform badge ─────────────────────────────────────────────────────────────
export function PlatBadge({ k, sz = 24 }: { k: string; sz?: number }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: sz,
        height: sz,
        borderRadius: 7,
        background: PLAT_COLORS[k] ?? "var(--brand)",
        color: "#fff",
        fontFamily: "var(--f-tech)",
        fontWeight: 700,
        fontSize: Math.round(sz * 0.42),
        flexShrink: 0,
        lineHeight: 1,
      }}
    >
      {platInitials(k)}
    </span>
  );
}

// ── Toggle switch ─────────────────────────────────────────────────────────────
export function Sw({ on, onClick, sm }: { on: boolean; onClick: () => void; sm?: boolean }) {
  const w = sm ? 36 : 42;
  const h = sm ? 20 : 24;
  const dotSz = sm ? 14 : 18;
  const dotOff = 3;
  const dotOn = sm ? 19 : 21;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      style={{
        width: w,
        height: h,
        borderRadius: 999,
        background: on ? "var(--yes)" : "var(--line-2)",
        border: 0,
        padding: 0,
        position: "relative",
        cursor: "pointer",
        flexShrink: 0,
        transition: ".18s",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: dotOff,
          left: on ? dotOn : dotOff,
          width: dotSz,
          height: dotSz,
          borderRadius: "50%",
          background: "#fff",
          boxShadow: "0 1px 3px rgba(11,20,55,.25)",
          transition: ".18s",
          display: "block",
        }}
      />
    </button>
  );
}

export const CHK = (
  <svg width="13" height="13" viewBox="0 0 13 13" style={{ flexShrink: 0 }} aria-hidden="true">
    <path
      d="M2.5 7l2.8 2.8L10.8 3.6"
      stroke="var(--yes)"
      strokeWidth="1.8"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const SHIELD = (
  <svg width="16" height="16" viewBox="0 0 15 15" style={{ flexShrink: 0 }} aria-hidden="true">
    <path
      d="M7.5 1l5 2.2v3.3c0 3.3-2.3 5-5 6.5-2.7-1.5-5-3.2-5-6.5V3.2z"
      stroke="var(--brand)"
      strokeWidth="1.3"
      fill="none"
    />
  </svg>
);

// ── USDC Base chain constants ─────────────────────────────────────────────────
export { USDC_BASE } from "@/lib/peer/config";
export const BASE_CHAIN_ID = 8453;

export const ERC20_TRANSFER_ABI = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

// ── Tx state types ─────────────────────────────────────────────────────────────
export type SellTxState = "idle" | "approving" | "creating" | "success" | "error";
export type SendTxState = "idle" | "sending" | "confirmed" | "error";
