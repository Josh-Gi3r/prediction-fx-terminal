"use client";

/**
 * components/portfolio/MultiChainWallet.tsx
 *
 * Multi-chain wallet area for the Portfolio page.
 * Shows Ethereum / Polygon / Base in separate sections.
 * Each section: chain badge, native gas line, token rows with per-row action buttons.
 *
 * Props:
 *   address        - connected wallet address
 *   onBridge       - opens FundWalletModal (Ethereum USDC/USDT -> Polygon)
 *   onSend         - opens SendModal (Ethereum, flag-gated)
 *   sendEnabled    - NEXT_PUBLIC_FEATURE_GASLESS_SEND flag
 */

import { Skeleton } from "@/components/ui/skeleton";
import {
  CHAIN_CONFIGS,
  type ChainBalances,
  type ChainConfig,
  type TokenBalance,
  useMultiChainBalances,
} from "@/lib/portfolio/chains";
import type { TransferToken } from "@/lib/privy/transfer";
import { fmtToken, fmtUsd } from "@/lib/fx-provider/core/format";
import { useMemo, useState } from "react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNative(human: number, symbol: string): string {
  if (human === 0) return `0 ${symbol}`;
  if (human < 0.0001) return `<0.0001 ${symbol}`;
  return `${human.toFixed(4)} ${symbol}`;
}

// ─── Chain badge ──────────────────────────────────────────────────────────────

function ChainBadge({ cfg }: { cfg: ChainConfig }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontFamily: "var(--f-tech)",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: cfg.color,
        background: `${cfg.color}18`,
        border: `1px solid ${cfg.color}40`,
        borderRadius: 999,
        padding: "3px 9px",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: cfg.color,
          flexShrink: 0,
        }}
      />
      {cfg.badge}
    </span>
  );
}

// ─── Action button ────────────────────────────────────────────────────────────

function ActionBtn({
  label,
  href,
  onClick,
  variant = "default",
}: {
  label: string;
  href?: string;
  onClick?: () => void;
  variant?: "default" | "primary" | "subtle";
}) {
  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 3,
    fontFamily: "var(--f-tech)",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.04em",
    borderRadius: 7,
    padding: "4px 10px",
    cursor: "pointer",
    border: "1px solid var(--line)",
    background: "var(--bg-tint)",
    color: "var(--ink)",
    textDecoration: "none",
    whiteSpace: "nowrap" as const,
    lineHeight: 1.4,
  };

  const styles: Record<string, React.CSSProperties> = {
    default: base,
    primary: { ...base, background: "var(--brand)", color: "#fff", border: "none" },
    subtle: {
      ...base,
      background: "none",
      color: "var(--brand)",
      border: "none",
      padding: "4px 6px",
    },
  };

  const style = styles[variant] ?? base;

  if (href) {
    return (
      <a href={href} style={style}>
        {label}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} style={style}>
      {label}
    </button>
  );
}

// ─── Token row ────────────────────────────────────────────────────────────────

function TokenRow({
  tb,
  cfg,
  onBridge,
  onSend,
  sendEnabled,
}: {
  tb: TokenBalance;
  cfg: ChainConfig;
  onBridge: () => void;
  onSend: (symbol: string, token: TransferToken, max: number) => void;
  sendEnabled: boolean;
}) {
  const { token, human, usd } = tb;
  const sendEligible =
    sendEnabled && cfg.id === 1 && (token.symbol === "USDC" || token.symbol === "USDT");

  return (
    <div className="rw" style={{ gridTemplateColumns: "1.6fr 1fr 1fr auto" }}>
      {/* Token */}
      <div className="tk">
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: "var(--bg-tint)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--f-tech)",
            fontSize: 8,
            fontWeight: 700,
            color: cfg.color,
            flexShrink: 0,
            border: `1px solid ${cfg.color}30`,
          }}
        >
          {token.symbol.replace(".", "").slice(0, 4)}
        </span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{token.symbol}</div>
        </div>
      </div>

      {/* Balance */}
      <div
        style={{ fontFamily: "var(--f-tech)", fontSize: 13, fontWeight: 700, alignSelf: "center" }}
      >
        {fmtToken(human)}
        {usd !== null && human > 0 && (
          <div style={{ fontSize: 11, fontWeight: 400, color: "var(--muted-2)" }}>
            {fmtUsd(usd)}
          </div>
        )}
      </div>

      {/* Primary action */}
      <div style={{ alignSelf: "center" }}>
        {cfg.id === 1 && (token.symbol === "USDC" || token.symbol === "USDT") && (
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            <ActionBtn label="Swap" href="/swap" variant="primary" />
            <ActionBtn label="Bridge" onClick={onBridge} />
          </div>
        )}
        {cfg.id === 137 && token.symbol === "USDC.e" && (
          <ActionBtn label="Bet" href="/wc" variant="primary" />
        )}
        {cfg.id === 137 && (token.symbol === "USDC" || token.symbol === "USDT") && (
          <ActionBtn label="Bet" href="/wc" />
        )}
        {cfg.id === 8453 && token.symbol === "USDC" && (
          <ActionBtn label="P2P" href="/cash" variant="primary" />
        )}
      </div>

      {/* Send (flag-gated, Ethereum stables only) */}
      <div style={{ alignSelf: "center" }}>
        {sendEligible ? (
          <ActionBtn
            label="Send"
            onClick={() => onSend(token.symbol, token.symbol.toLowerCase() as TransferToken, human)}
          />
        ) : (
          <span style={{ fontSize: 11, color: "var(--muted-2)" }} />
        )}
      </div>
    </div>
  );
}

// ─── Single chain section ─────────────────────────────────────────────────────

function ChainSection({
  cfg,
  balances,
  onBridge,
  onSend,
  sendEnabled,
}: {
  cfg: ChainConfig;
  balances: ChainBalances;
  onBridge: () => void;
  onSend: (symbol: string, token: TransferToken, max: number) => void;
  sendEnabled: boolean;
}) {
  const nonZeroTokens = balances.tokens.filter((tb) => tb.human > 0.000001);
  const hasGas = balances.nativeHuman > 0.000001;
  const isEmpty = !hasGas && nonZeroTokens.length === 0;
  const isLoading = balances.loading;

  // Empty state CTAs by chain
  const emptyCtaMap: Record<number, { text: string; href?: string; action?: () => void }> = {
    1: { text: "No stables on Ethereum — swap or deposit to start.", href: "/swap" },
    137: { text: "No USDC.e yet — Bridge from Ethereum first.", action: onBridge },
    8453: { text: "No USDC on Base yet — deposit to use P2P.", href: "/cash" },
  };

  const emptyCta = emptyCtaMap[cfg.id];

  return (
    <div
      style={{
        border: "1px solid var(--line)",
        borderRadius: 13,
        overflow: "hidden",
        background: "#fff",
      }}
    >
      {/* Section header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 15px",
          borderBottom: "1px solid var(--line)",
          background: "var(--bg-soft)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <ChainBadge cfg={cfg} />
          <span
            style={{
              fontFamily: "var(--f-tech)",
              fontSize: 12,
              fontWeight: 700,
              color: "var(--ink)",
            }}
          >
            {cfg.label}
          </span>
        </div>

        {balances.error && (
          <span
            style={{
              fontFamily: "var(--f-tech)",
              fontSize: 10,
              color: "var(--no)",
              letterSpacing: "0.06em",
            }}
          >
            RPC error — balances may be stale
          </span>
        )}
      </div>

      {/* Native gas line */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "9px 15px",
          borderBottom: "1px solid var(--line)",
          background: hasGas ? "transparent" : "rgba(240,67,106,0.03)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span
            style={{
              fontFamily: "var(--f-tech)",
              fontSize: 10,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--muted-2)",
            }}
          >
            Gas
          </span>
          {isLoading ? (
            <Skeleton className="h-4 w-20" />
          ) : (
            <span
              style={{
                fontFamily: "var(--f-tech)",
                fontSize: 12,
                fontWeight: 700,
                color: hasGas ? "var(--ink)" : "var(--no)",
              }}
            >
              {fmtNative(balances.nativeHuman, cfg.nativeSymbol)}
            </span>
          )}
        </div>
        {!hasGas && !isLoading && (
          <span
            style={{
              fontFamily: "var(--f-tech)",
              fontSize: 10,
              color: "var(--no)",
              letterSpacing: "0.04em",
            }}
          >
            {cfg.gasNote}
          </span>
        )}
      </div>

      {/* Token rows */}
      {isLoading ? (
        <div style={{ padding: "12px 15px", display: "flex", flexDirection: "column", gap: 8 }}>
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : isEmpty ? (
        <div
          style={{
            padding: "18px 15px",
            color: "var(--muted-2)",
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <span>{emptyCta?.text}</span>
          {emptyCta?.href && (
            <a
              href={emptyCta.href}
              style={{
                fontFamily: "var(--f-tech)",
                fontSize: 11,
                fontWeight: 700,
                color: "var(--brand)",
                whiteSpace: "nowrap",
              }}
            >
              {cfg.id === 1 ? "Go to Swap" : cfg.id === 8453 ? "Go to P2P" : ""}
            </a>
          )}
          {emptyCta?.action && (
            <button
              type="button"
              onClick={emptyCta.action}
              style={{
                fontFamily: "var(--f-tech)",
                fontSize: 11,
                fontWeight: 700,
                color: "var(--brand)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
                whiteSpace: "nowrap",
              }}
            >
              Bridge now
            </button>
          )}
        </div>
      ) : (
        <div className="ptbl" style={{ border: "none", borderRadius: 0 }}>
          <div className="hd" style={{ gridTemplateColumns: "1.6fr 1fr 1fr auto" }}>
            <div>Token</div>
            <div>Balance</div>
            <div>Action</div>
            <div>{sendEnabled && cfg.id === 1 ? "Send" : ""}</div>
          </div>
          {nonZeroTokens.map((tb) => (
            <TokenRow
              key={tb.token.address}
              tb={tb}
              cfg={cfg}
              onBridge={onBridge}
              onSend={onSend}
              sendEnabled={sendEnabled}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Receive panel ────────────────────────────────────────────────────────────

function ReceivePanel({ address }: { address: `0x${string}` }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <div
      style={{
        background: "var(--bg-soft)",
        border: "1px solid var(--line)",
        borderRadius: 13,
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {/* Header */}
      <div
        style={{
          fontFamily: "var(--f-tech)",
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--muted-2)",
        }}
      >
        Receive
      </div>

      {/* Address + copy */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span
          style={{
            fontFamily: "var(--f-tech)",
            fontSize: 13,
            fontWeight: 700,
            color: "var(--ink)",
            wordBreak: "break-all",
            flex: 1,
            minWidth: 0,
          }}
        >
          {address}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          style={{
            fontFamily: "var(--f-tech)",
            fontSize: 11,
            fontWeight: 700,
            color: copied ? "var(--yes)" : "var(--brand)",
            background: "none",
            border: "1px solid var(--line)",
            borderRadius: 7,
            padding: "4px 11px",
            cursor: "pointer",
            flexShrink: 0,
            transition: "color 0.15s",
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      {/* Network note */}
      <p
        style={{
          margin: 0,
          fontSize: 12,
          color: "var(--muted)",
          lineHeight: 1.55,
        }}
      >
        This address works on Ethereum, Polygon and Base. Always verify the network before sending.
      </p>

      {/* Explorer links */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {CHAIN_CONFIGS.map((cfg) => (
          <a
            key={cfg.id}
            href={cfg.explorerAddr(address)}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontFamily: "var(--f-tech)",
              fontSize: 10,
              fontWeight: 700,
              color: cfg.color,
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: 4,
              letterSpacing: "0.04em",
            }}
          >
            {cfg.label} explorer
            <svg width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden="true">
              <path
                d="M2 1h7v7M9 1 1 9"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </a>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface MultiChainWalletProps {
  address: `0x${string}`;
  onBridge: () => void;
  onSend: (symbol: string, token: TransferToken, max: number) => void;
  sendEnabled: boolean;
}

export function MultiChainWallet({
  address,
  onBridge,
  onSend,
  sendEnabled,
}: MultiChainWalletProps) {
  const { chains, totalUsd, anyLoading } = useMultiChainBalances(address);

  // Map chain ID -> ChainBalances
  const balancesByChain = useMemo(() => {
    const m: Record<number, ChainBalances> = {};
    for (const cb of chains) {
      m[cb.chainId] = cb;
    }
    return m;
  }, [chains]);

  return (
    <div className="pf-card">
      {/* Card header */}
      <div className="ch">
        <div>
          <div className="eyebrow">
            <span className="tick" />
            Wallet
          </div>
          <h3 style={{ marginTop: 4 }}>
            {anyLoading ? (
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                In your wallet
                <Skeleton className="h-6 w-20 inline-block" />
              </span>
            ) : (
              `In your wallet · ${fmtUsd(totalUsd)}`
            )}
          </h3>
        </div>
        <span className="right">Ethereum · Polygon · Base</span>
      </div>

      {/* Per-chain sections */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {CHAIN_CONFIGS.map((cfg) => {
          const cb = balancesByChain[cfg.id];
          if (!cb) return null;
          return (
            <ChainSection
              key={cfg.id}
              cfg={cfg}
              balances={cb}
              onBridge={onBridge}
              onSend={onSend}
              sendEnabled={sendEnabled}
            />
          );
        })}
      </div>

      {/* Receive panel */}
      <div style={{ marginTop: 14 }}>
        <ReceivePanel address={address} />
      </div>
    </div>
  );
}
