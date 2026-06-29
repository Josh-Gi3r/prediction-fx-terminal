"use client";

/**
 * components/mobile/earn/primitives.tsx
 * Shared micro-components used across earn panels.
 */

import { ConnectWalletButton } from "@/components/shared/ConnectWalletButton";
import { useAccount, useSwitchChain } from "wagmi";

/* ── Mobile connect button ──────────────────────────────────────────────────── */

export function MobileConnectButton() {
  const { isConnected } = useAccount();
  if (isConnected) return null;
  return <ConnectWalletButton className="btn btn-primary btn-block" style={{ marginTop: 4 }} />;
}

/* ── Chain-switch banner ────────────────────────────────────────────────────── */

export function ChainBanner({ label, chainId }: { label: string; chainId: number }) {
  const { switchChain } = useSwitchChain();
  return (
    <div className="warn-banner">
      <span>{label}</span>
      <button type="button" onClick={() => switchChain({ chainId })} className="warn-btn">
        Switch chain
      </button>
    </div>
  );
}

/* ── Error / success banners ────────────────────────────────────────────────── */

export function ErrBanner({ msg, onRetry }: { msg: string; onRetry: () => void }) {
  return (
    <div className="err-banner">
      <span className="eb-msg">{msg}</span>
      <button type="button" className="eb-retry" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}

export function OkBanner({ children }: { children: React.ReactNode }) {
  return <div className="ok-banner">{children}</div>;
}

export function InfoNote({ children }: { children: React.ReactNode }) {
  return <div className="info-note">{children}</div>;
}

/* ── Amount input ───────────────────────────────────────────────────────────── */

export function AmountInput({
  label,
  value,
  onChange,
  disabled,
  placeholder,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  error?: string | null;
}) {
  return (
    <div className="efield">
      <div className="eyebrow-sm">{label}</div>
      <div className="ebudget">
        <span className="ccy">USDC</span>
        <input
          inputMode="decimal"
          value={value}
          onChange={(e) => /^\d*\.?\d*$/.test(e.target.value) && onChange(e.target.value)}
          placeholder={placeholder ?? "0.0"}
          disabled={disabled}
        />
      </div>
      {error && <div className="field-err">{error}</div>}
    </div>
  );
}
