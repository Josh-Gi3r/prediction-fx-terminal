"use client";

// ─── Shared style constants ────────────────────────────────────────────────────
export const SEC: React.CSSProperties = {
  background: "#fff",
  border: "1px solid var(--line)",
  borderRadius: "var(--r-lg)",
  boxShadow: "var(--sh-1)",
  padding: 22,
};
export const SEC_FEAT: React.CSSProperties = {
  ...SEC,
  boxShadow: "var(--sh-3)",
  borderColor: "var(--line-2)",
};
export const CARD: React.CSSProperties = {
  background: "var(--bg-soft)",
  border: "1px solid var(--line)",
  borderRadius: 16,
  padding: 16,
};
export const INNER_CARD: React.CSSProperties = {
  background: "#fff",
  border: "1px solid var(--line)",
  borderRadius: 11,
  padding: "11px 13px",
};
export const BTN_PRI: React.CSSProperties = {
  width: "100%",
  padding: 13,
  borderRadius: 12,
  border: 0,
  cursor: "pointer",
  fontFamily: "var(--f-ui)",
  fontWeight: 800,
  fontSize: 14,
  background: "var(--grad-brand)",
  color: "#fff",
  boxShadow: "var(--sh-brand)",
  transition: ".15s",
};
export const BTN_PRI_DIS: React.CSSProperties = {
  ...BTN_PRI,
  opacity: 0.5,
  cursor: "not-allowed",
  boxShadow: "none",
  background: "var(--line-2)",
};

// ─── EarnSection ──────────────────────────────────────────────────────────────
export function EarnSection({
  title,
  subtitle,
  children,
  id,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section id={id} style={{ ...SEC, display: "flex", flexDirection: "column" }}>
      <div style={{ marginBottom: 16 }}>
        <h3
          style={{
            fontFamily: "var(--f-display)",
            fontWeight: 800,
            fontSize: 20,
            color: "var(--ink)",
            margin: 0,
            letterSpacing: "-0.01em",
          }}
        >
          {title}
        </h3>
        <p
          style={{
            margin: "7px 0 0",
            fontSize: 12.5,
            color: "var(--muted)",
            lineHeight: 1.55,
            maxWidth: 760,
          }}
        >
          {subtitle}
        </p>
      </div>
      {children}
    </section>
  );
}

// ─── SumRow ───────────────────────────────────────────────────────────────────
export function SumRow({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        padding: "5px 0",
        fontSize: 12,
      }}
    >
      <span style={{ color: "var(--muted)", whiteSpace: "nowrap" }}>{k}</span>
      <span
        style={{
          fontFamily: "var(--f-tech)",
          fontWeight: 700,
          whiteSpace: "nowrap",
          textAlign: "right",
        }}
      >
        {children}
      </span>
    </div>
  );
}

// ─── StatusBanner ─────────────────────────────────────────────────────────────
export type BannerVariant = "success" | "error" | "warning" | "info";

const BANNER_STYLES: Record<BannerVariant, React.CSSProperties> = {
  success: {
    borderColor: "rgba(19,185,129,.4)",
    background: "rgba(19,185,129,.07)",
    color: "#0a7a53",
  },
  error: {
    borderColor: "rgba(240,67,106,.3)",
    background: "rgba(240,67,106,.06)",
    color: "#b61441",
  },
  warning: {
    borderColor: "rgba(240,172,67,.4)",
    background: "rgba(240,172,67,.08)",
    color: "#8a5f0a",
  },
  info: {
    borderColor: "rgba(100,130,240,.25)",
    background: "rgba(100,130,240,.05)",
    color: "var(--brand)",
  },
};

export function StatusBanner({
  variant,
  children,
  style,
}: {
  variant: BannerVariant;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        borderRadius: 9,
        border: "1px solid",
        padding: "8px 11px",
        fontSize: 12,
        ...BANNER_STYLES[variant],
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ─── WrongChainBanner ─────────────────────────────────────────────────────────
export function WrongChainBanner({
  message,
  onSwitch,
  switchLabel,
}: {
  message: string;
  onSwitch: () => void;
  switchLabel: string;
}) {
  return (
    <StatusBanner
      variant="warning"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        padding: "9px 12px",
        fontSize: 12.5,
      }}
    >
      <span>{message}</span>
      <button
        type="button"
        onClick={onSwitch}
        style={{
          fontFamily: "var(--f-tech)",
          fontWeight: 700,
          fontSize: 11,
          padding: "6px 12px",
          borderRadius: 8,
          border: "1px solid #c2750a",
          background: "#fff",
          color: "#8a5f0a",
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        {switchLabel}
      </button>
    </StatusBanner>
  );
}

// ─── AmountInput ──────────────────────────────────────────────────────────────
export function AmountInput({
  value,
  onChange,
  placeholder,
  disabled,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <div>
      {label && (
        <div
          style={{
            fontFamily: "var(--f-tech)",
            fontSize: 10,
            letterSpacing: ".1em",
            textTransform: "uppercase",
            color: "var(--muted-2)",
            marginBottom: 6,
          }}
        >
          {label}
        </div>
      )}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          border: "1px solid var(--line)",
          borderRadius: 10,
          background: "#fff",
          padding: "9px 12px",
        }}
      >
        <span
          style={{
            fontFamily: "var(--f-ui)",
            fontSize: 13,
            color: "var(--muted)",
            flexShrink: 0,
          }}
        >
          USDC
        </span>
        <input
          inputMode="decimal"
          value={value}
          onChange={(e) => /^\d*\.?\d*$/.test(e.target.value) && onChange(e.target.value)}
          placeholder={placeholder ?? "100"}
          disabled={disabled}
          style={{
            flex: 1,
            border: 0,
            background: "none",
            textAlign: "right",
            fontFamily: "var(--f-display)",
            fontWeight: 800,
            fontSize: 22,
            color: "var(--ink)",
            outline: "none",
          }}
        />
      </div>
    </div>
  );
}

// ─── RetryErrorRow ────────────────────────────────────────────────────────────
export function RetryErrorRow({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <StatusBanner
      variant="error"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
      }}
    >
      <span>{message}</span>
      <button
        type="button"
        onClick={onRetry}
        style={{
          fontFamily: "var(--f-tech)",
          fontSize: 11,
          padding: "4px 9px",
          borderRadius: 7,
          border: "1px solid rgba(240,67,106,.3)",
          background: "#fff",
          color: "#b61441",
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        Retry
      </button>
    </StatusBanner>
  );
}
