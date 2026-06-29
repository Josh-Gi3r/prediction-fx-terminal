"use client";

/**
 * components/mobile/MobileAccountSheet.tsx
 *
 * Bottom-sheet account panel for the mobile shell.
 * Reuses: usePrivy + useWallets from @privy-io/react-auth,
 *         useMultiChainBalances from lib/portfolio/chains,
 *         ActivityTab + SettingsTab + WalletTab + SecurityTab from components/account/,
 *         FundWalletModal from components/wc/FundWalletModal.tsx.
 *
 * Activity, Settings, Wallet, and Security render INSIDE the sheet (no page
 * navigation), which is required for the Telegram mini-app context where <a href>
 * navigation exits the WebView.
 *
 * Fund opens FundWalletModal in-place instead of routing to /portfolio.
 */

import { ActivityTab } from "@/components/account/ActivityTab";
import { SecurityTab } from "@/components/account/SecurityTab";
import { SettingsTab } from "@/components/account/SettingsTab";
import { WalletTab } from "@/components/account/WalletTab";
import { FundWalletModal } from "@/components/wc/FundWalletModal";
import { useMultiChainBalances } from "@/lib/portfolio/chains";
import { PRIVY_ENABLED } from "@/lib/privy/config";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useState } from "react";
import { Icon } from "./Icon";

// ── identity helpers (mirrors AccountChip.tsx) ────────────────────────────────

function shorten(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function displayName(user: ReturnType<typeof usePrivy>["user"], address: string | null): string {
  if (!user) return address ? shorten(address) : "Account";
  if (user.email?.address) {
    const local = user.email.address.split("@")[0];
    return local && local.length > 0 ? local : shorten(address ?? "0x0000");
  }
  if (user.google?.email) {
    const local = user.google.email.split("@")[0];
    return local && local.length > 0 ? local : "Google";
  }
  if (user.apple?.email) {
    return user.apple.email.split("@")[0] ?? "Apple";
  }
  const tw = (user as { twitter?: { username?: string } }).twitter?.username;
  if (tw) return `@${tw}`;
  return address ? shorten(address) : "Account";
}

function loginMethod(user: ReturnType<typeof usePrivy>["user"]): string {
  if (!user) return "";
  if (user.email?.address) return "email";
  if (user.google?.email) return "Google";
  if (user.apple?.email) return "Apple";
  if ((user as { twitter?: { username?: string } }).twitter?.username) return "X";
  if (user.linkedAccounts?.some((a) => a.type === "wallet")) return "wallet";
  return "";
}

/**
 * Returns true when the user has an embedded (Privy) wallet but no second
 * login method linked — meaning they cannot recover the wallet if they lose
 * their primary login.
 */
function hasBackupGap(user: ReturnType<typeof usePrivy>["user"]): boolean {
  if (!user) return false;
  const linked = user.linkedAccounts ?? [];
  const hasEmbedded = linked.some(
    (a) => a.type === "wallet" && (a as { walletClientType?: string }).walletClientType === "privy",
  );
  if (!hasEmbedded) return false;
  // Count non-embedded login methods
  const hasEmail = !!user.email?.address;
  const hasGoogle = !!user.google?.email;
  const hasApple = !!user.apple?.email;
  const hasExtWallet = linked.some(
    (a) => a.type === "wallet" && (a as { walletClientType?: string }).walletClientType !== "privy",
  );
  const methodCount = [hasEmail, hasGoogle, hasApple, hasExtWallet].filter(Boolean).length;
  // Gap = embedded wallet but only ONE linked method (the one they signed up with —
  // if it's just the embedded wallet and the auth they logged in with, they're exposed).
  return methodCount < 2;
}

// ── props ─────────────────────────────────────────────────────────────────────

interface MobileAccountSheetProps {
  open: boolean;
  onClose: () => void;
  /** Navigate to the portfolio tab (fallback for non-mini-app contexts). */
  onGoPortfolio: () => void;
}

// ── Sub-panel type ─────────────────────────────────────────────────────────────

type SubPanel = "activity" | "settings" | "wallet" | "security" | null;

// ── inner (requires Privy context) ────────────────────────────────────────────

function SheetInner({ open, onClose, onGoPortfolio }: MobileAccountSheetProps) {
  const { user, logout } = usePrivy();
  const { wallets } = useWallets();
  const address = (wallets[0]?.address ?? null) as `0x${string}` | null;
  const [copied, setCopied] = useState(false);
  const [subPanel, setSubPanel] = useState<SubPanel>(null);
  const [fundOpen, setFundOpen] = useState(false);

  const { totalUsd, anyLoading } = useMultiChainBalances(address as `0x${string}` | undefined);

  const name = displayName(user, address);
  const method = loginMethod(user);
  const balanceLabel = anyLoading
    ? "..."
    : `$${totalUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const showBackupNudge = hasBackupGap(user);

  async function copy() {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable in some Telegram WebView builds
    }
  }

  async function handleLogout() {
    onClose();
    try {
      await logout();
    } catch {
      // ignore
    }
  }

  function handleClose() {
    setSubPanel(null);
    onClose();
  }

  const baseRow: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 13,
    padding: "13px 16px",
    borderRadius: 13,
    width: "100%",
    background: "none",
    border: 0,
    cursor: "pointer",
    textDecoration: "none",
    color: "var(--ink)",
    fontFamily: "var(--f-ui)",
    fontWeight: 600,
    fontSize: 15,
    textAlign: "left" as const,
  };

  const ic: React.CSSProperties = {
    width: 42,
    height: 42,
    borderRadius: 13,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  };

  // Back chevron for sub-panel header
  const SubPanelBack = ({ label }: { label: string }) => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "6px 0 14px",
        borderBottom: "1px solid var(--line)",
        marginBottom: 12,
      }}
    >
      <button
        type="button"
        onClick={() => setSubPanel(null)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--brand)",
          fontFamily: "var(--f-ui)",
          fontWeight: 700,
          fontSize: 14,
          padding: 0,
        }}
      >
        <Icon name="back" size={18} color="var(--brand)" />
        Back
      </button>
      <span
        style={{
          fontFamily: "var(--f-display)",
          fontWeight: 800,
          fontSize: 17,
          letterSpacing: "-.01em",
          color: "var(--ink)",
          marginLeft: 4,
        }}
      >
        {label}
      </span>
    </div>
  );

  // ── Wallet sub-panel wrapper ─────────────────────────────────────────────────
  // WalletTab expects an address prop and renders MultiChainWallet + embedded
  // wallet export + linked accounts. We pass the same address the sheet uses.
  // If no address is available yet, show a brief fallback.
  const WalletPanel = () => {
    if (!address) {
      return (
        <div
          style={{ padding: "24px 0", textAlign: "center", color: "var(--muted)", fontSize: 13 }}
        >
          Connect a wallet to manage it here.
        </div>
      );
    }
    return <WalletTab address={address} />;
  };

  return (
    <>
      <div
        className={`sheet-scrim${open ? " open" : ""}`}
        onClick={handleClose}
        style={{ zIndex: 70 }}
      />
      <div className={`sheet${open ? " open" : ""}`} style={{ zIndex: 71 }}>
        <div className="grab" />
        <div className="sbody">
          {/* Sub-panel: Activity */}
          {subPanel === "activity" && address ? (
            <>
              <SubPanelBack label="Activity" />
              <ActivityTab address={address} />
            </>
          ) : subPanel === "settings" ? (
            /* Sub-panel: Settings */
            <>
              <SubPanelBack label="Settings" />
              <SettingsTab />
            </>
          ) : subPanel === "wallet" ? (
            /* Sub-panel: Wallet — export key + linked accounts */
            <>
              <SubPanelBack label="Wallet" />
              <WalletPanel />
            </>
          ) : subPanel === "security" ? (
            /* Sub-panel: Security — login methods, session, allowances */
            <>
              <SubPanelBack label="Security" />
              <SecurityTab />
            </>
          ) : (
            /* Main panel */
            <>
              {/* Identity + balance header */}
              <div
                style={{
                  padding: "6px 4px 16px",
                  borderBottom: "1px solid var(--line)",
                  marginBottom: 6,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      fontFamily: "var(--f-display)",
                      fontWeight: 800,
                      fontSize: 20,
                      letterSpacing: "-.01em",
                      color: "var(--ink)",
                    }}
                  >
                    {name}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--f-tech)",
                      fontWeight: 800,
                      fontSize: 20,
                      color: anyLoading ? "var(--muted)" : "var(--ink)",
                      letterSpacing: "-.01em",
                    }}
                  >
                    {balanceLabel}
                  </div>
                </div>
                {method ? (
                  <div
                    style={{
                      fontFamily: "var(--f-tech)",
                      fontSize: 11,
                      color: "var(--muted-2)",
                      marginTop: 3,
                      letterSpacing: ".03em",
                    }}
                  >
                    via {method}
                  </div>
                ) : null}
                {address ? (
                  <div
                    style={{
                      fontFamily: "var(--f-tech)",
                      fontSize: 11,
                      color: "var(--muted-2)",
                      marginTop: 2,
                    }}
                  >
                    {shorten(address)}
                  </div>
                ) : null}
              </div>

              {/* Backup nudge — shown when embedded wallet has no second recovery method */}
              {showBackupNudge && (
                <button
                  type="button"
                  onClick={() => setSubPanel("wallet")}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    padding: "11px 14px",
                    marginBottom: 6,
                    borderRadius: 12,
                    background: "rgba(240,167,30,.10)",
                    border: "1px solid rgba(240,167,30,.35)",
                    width: "100%",
                    cursor: "pointer",
                    textAlign: "left" as const,
                  }}
                >
                  <span style={{ fontSize: 16, lineHeight: 1, marginTop: 1 }}>⚠️</span>
                  <div>
                    <div
                      style={{
                        fontFamily: "var(--f-ui)",
                        fontWeight: 700,
                        fontSize: 13,
                        color: "#92400e",
                      }}
                    >
                      Secure your wallet
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--f-ui)",
                        fontSize: 11,
                        color: "#92400e",
                        opacity: 0.85,
                        marginTop: 2,
                        lineHeight: 1.45,
                      }}
                    >
                      Export your private key or link a backup login so you can recover this wallet.
                    </div>
                  </div>
                  <Icon name="chevron" size={14} color="#92400e" />
                </button>
              )}

              {/* Fund wallet -- opens FundWalletModal in-sheet (Telegram safe) */}
              <button
                type="button"
                style={baseRow}
                onClick={() => {
                  setFundOpen(true);
                }}
              >
                <span style={{ ...ic, background: "var(--bg-tint)" }}>
                  <Icon name="wallet" size={20} color="var(--brand)" />
                </span>
                <div>
                  <div>Fund wallet</div>
                  <div
                    style={{ fontSize: 12, color: "var(--muted)", fontWeight: 500, marginTop: 1 }}
                  >
                    Bridge ETH stables to Polygon
                  </div>
                </div>
              </button>

              {/* Copy address */}
              <button type="button" style={baseRow} onClick={copy}>
                <span style={{ ...ic, background: "var(--bg-tint)" }}>
                  <Icon
                    name={copied ? "check" : "share"}
                    size={20}
                    color={copied ? "var(--accent-2)" : "var(--brand)"}
                  />
                </span>
                <div>{copied ? "Copied" : "Copy address"}</div>
              </button>

              {/* Wallet — export private key + linked recovery accounts */}
              <button type="button" style={baseRow} onClick={() => setSubPanel("wallet")}>
                <span style={{ ...ic, background: "var(--bg-tint)" }}>
                  <Icon name="bolt" size={20} color="var(--brand)" />
                </span>
                <div style={{ flex: 1 }}>
                  <div>Wallet</div>
                  <div
                    style={{ fontSize: 12, color: "var(--muted)", fontWeight: 500, marginTop: 1 }}
                  >
                    Export key · link recovery accounts
                  </div>
                </div>
                <Icon name="chevron" size={16} color="var(--muted-2)" />
              </button>

              {/* Security — login methods, session, allowances */}
              <button type="button" style={baseRow} onClick={() => setSubPanel("security")}>
                <span style={{ ...ic, background: "var(--bg-tint)" }}>
                  <Icon name="check" size={20} color="var(--brand)" />
                </span>
                <div style={{ flex: 1 }}>
                  <div>Security</div>
                  <div
                    style={{ fontSize: 12, color: "var(--muted)", fontWeight: 500, marginTop: 1 }}
                  >
                    Login methods · token approvals
                  </div>
                </div>
                <Icon name="chevron" size={16} color="var(--muted-2)" />
              </button>

              {/* Activity -- renders inside sheet, no navigation */}
              <button type="button" style={baseRow} onClick={() => setSubPanel("activity")}>
                <span style={{ ...ic, background: "var(--bg-tint)" }}>
                  <Icon name="arrow" size={20} color="var(--brand)" />
                </span>
                <div style={{ flex: 1 }}>Activity</div>
                <Icon name="chevron" size={16} color="var(--muted-2)" />
              </button>

              {/* Settings -- renders inside sheet, no navigation */}
              <button type="button" style={baseRow} onClick={() => setSubPanel("settings")}>
                <span style={{ ...ic, background: "var(--bg-tint)" }}>
                  <Icon name="info" size={20} color="var(--brand)" />
                </span>
                <div style={{ flex: 1 }}>Settings</div>
                <Icon name="chevron" size={16} color="var(--muted-2)" />
              </button>

              <div style={{ borderTop: "1px solid var(--line)", margin: "6px 0" }} />

              {/* Disconnect */}
              <button
                type="button"
                style={{ ...baseRow, color: "var(--no, #f0436a)" }}
                onClick={handleLogout}
              >
                <span style={{ ...ic, background: "#fdebef" }}>
                  <Icon name="back" size={20} color="var(--no, #f0436a)" />
                </span>
                <div>Disconnect</div>
              </button>

              <div style={{ height: 8 }} />
            </>
          )}
        </div>
      </div>

      {/* Fund wallet modal -- rendered at sheet level so it sits above the sheet */}
      <FundWalletModal open={fundOpen} onClose={() => setFundOpen(false)} />
    </>
  );
}

/**
 * Exported wrapper. Guards against Privy being disabled (renders nothing).
 * Caller should only open when authenticated.
 */
export function MobileAccountSheet(props: MobileAccountSheetProps) {
  if (!PRIVY_ENABLED) return null;
  return <SheetInner {...props} />;
}

import type React from "react";
