"use client";

/**
 * components/account/AccountChip.tsx
 *
 * The upgraded wallet pill shown in the Nav. Replaces the old WalletMenu
 * (copy/explorer/disconnect only) with an account chip that shows:
 *   - Identity row: display name from Privy login method + balance
 *   - Actions: Fund, Activity, Settings deep-links to /account?tab=
 *   - Kept: Copy address, per-chain explorer, Disconnect
 *
 * Mounted by components/shared/ConnectButton.tsx only when authenticated.
 */

import { useMultiChainBalances } from "@/lib/portfolio/chains";
import { fmt } from "@/lib/fx-provider/core/format";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { Activity, Check, Copy, ExternalLink, LogOut, Settings, Wallet } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useChainId } from "wagmi";

function shorten(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function explorerUrl(address: string, chainId: number): string {
  switch (chainId) {
    case 137:
      return `https://polygonscan.com/address/${address}`;
    case 8453:
      return `https://basescan.org/address/${address}`;
    default:
      return `https://etherscan.io/address/${address}`;
  }
}

/** Derive a display name from the Privy user object. */
function displayName(user: ReturnType<typeof usePrivy>["user"], address: string | null): string {
  if (!user) return address ? shorten(address) : "Account";

  // Email login
  if (user.email?.address) {
    const local = user.email.address.split("@")[0];
    return local && local.length > 0 ? local : shorten(address ?? "0x0000");
  }
  // Google
  if (user.google?.email) {
    const local = user.google.email.split("@")[0];
    return local && local.length > 0 ? local : "Google";
  }
  // Apple
  if (user.apple?.email) {
    return user.apple.email.split("@")[0] ?? "Apple";
  }
  // Twitter/X
  if ((user as { twitter?: { username?: string } }).twitter?.username) {
    return `@${(user as { twitter?: { username?: string } }).twitter!.username}`;
  }

  return address ? shorten(address) : "Account";
}

/** Short login-method label shown in the identity row. */
function loginMethod(user: ReturnType<typeof usePrivy>["user"]): string {
  if (!user) return "";
  if (user.email?.address) return "email";
  if (user.google?.email) return "Google";
  if (user.apple?.email) return "Apple";
  if ((user as { twitter?: { username?: string } }).twitter?.username) return "X";
  if (user.linkedAccounts?.some((a) => a.type === "wallet")) return "wallet";
  return "";
}

interface AccountChipProps {
  address: string | null;
  onLogout: () => void;
}

export function AccountChip({ address, onLogout }: AccountChipProps) {
  const { user } = usePrivy();
  const { wallets } = useWallets();
  const chainId = useChainId();

  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Balance across all chains
  const { totalUsd, anyLoading } = useMultiChainBalances(address as `0x${string}` | undefined);

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function copy() {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable
    }
  }

  const name = displayName(user, address);
  const method = loginMethod(user);
  const balanceLabel = anyLoading ? "..." : totalUsd > 0 ? `$${fmt(totalUsd, 2)}` : "$0.00";

  const item: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 9,
    width: "100%",
    padding: "9px 12px",
    fontFamily: "var(--f-ui)",
    fontWeight: 600,
    fontSize: 13.5,
    color: "var(--ink)",
    background: "none",
    border: 0,
    borderRadius: 9,
    cursor: "pointer",
    textAlign: "left" as const,
    textDecoration: "none",
    lineHeight: 1.3,
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {/* Pill trigger */}
      <button
        type="button"
        className="netsel nav-wallet"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title="Account menu"
      >
        <span className="net-dot" />
        <span style={{ fontFamily: "var(--f-tech)", letterSpacing: ".02em" }}>{name}</span>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 8px)",
            zIndex: 95,
            width: 252,
            padding: 6,
            background: "#fff",
            border: "1px solid var(--line)",
            borderRadius: 14,
            boxShadow: "0 18px 50px rgba(5,10,30,.14)",
          }}
        >
          {/* Identity + balance row */}
          <div
            style={{
              padding: "10px 12px 8px",
              borderBottom: "1px solid var(--line)",
              marginBottom: 4,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 14,
                  color: "var(--ink)",
                  fontFamily: "var(--f-tech)",
                  letterSpacing: ".01em",
                }}
              >
                {name}
              </div>
              <div
                style={{
                  fontFamily: "var(--f-tech)",
                  fontWeight: 800,
                  fontSize: 13,
                  color: anyLoading ? "var(--muted)" : "var(--ink)",
                }}
              >
                {balanceLabel}
              </div>
            </div>
            {method && (
              <div
                style={{
                  fontSize: 11,
                  color: "var(--muted-2)",
                  marginTop: 2,
                  fontFamily: "var(--f-tech)",
                  letterSpacing: ".02em",
                }}
              >
                via {method}
              </div>
            )}
            {address && (
              <div
                style={{
                  fontSize: 11,
                  color: "var(--muted-2)",
                  marginTop: 1,
                  fontFamily: "var(--f-tech)",
                }}
              >
                {shorten(address)}
              </div>
            )}
          </div>

          {/* Action rows */}
          <a
            href="/account?tab=wallet"
            style={item}
            className="wmenu-item"
            onClick={() => setOpen(false)}
          >
            <Wallet className="size-4 opacity-60" />
            Fund wallet
          </a>

          <a
            href="/account?tab=activity"
            style={item}
            className="wmenu-item"
            onClick={() => setOpen(false)}
          >
            <Activity className="size-4 opacity-60" />
            Activity
          </a>

          <a
            href="/account?tab=settings"
            style={item}
            className="wmenu-item"
            onClick={() => setOpen(false)}
          >
            <Settings className="size-4 opacity-60" />
            Settings
          </a>

          {/* Divider */}
          <div style={{ borderTop: "1px solid var(--line)", margin: "4px 0" }} />

          {/* Copy address */}
          <button type="button" style={item} className="wmenu-item" onClick={copy}>
            {copied ? (
              <Check className="size-4" style={{ color: "var(--accent)" }} />
            ) : (
              <Copy className="size-4 opacity-60" />
            )}
            {copied ? "Copied" : "Copy address"}
          </button>

          {/* Explorer */}
          {address && (
            <a
              style={item}
              className="wmenu-item"
              href={explorerUrl(address, chainId)}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink className="size-4 opacity-60" />
              View on explorer
            </a>
          )}

          {/* Disconnect */}
          <button
            type="button"
            style={{ ...item, color: "var(--no, #f0436a)" }}
            className="wmenu-item"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
          >
            <LogOut className="size-4" />
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
