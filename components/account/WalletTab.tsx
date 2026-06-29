"use client";

/**
 * components/account/WalletTab.tsx
 *
 * Account page Wallet tab:
 *   - MultiChainWallet (balances + per-row actions)
 *   - Privy embedded wallet management: export key, link accounts, linked accounts list
 *   - Funding hub CTA
 */

import { MultiChainWallet } from "@/components/portfolio/MultiChainWallet";
import { SendModal } from "@/components/portfolio/SendModal";
import { FundWalletModal } from "@/components/wc/FundWalletModal";
import { TRANSFER_TOKENS, type TransferToken } from "@/lib/privy/transfer";
import { useExportWallet, useLinkAccount, usePrivy, useWallets } from "@privy-io/react-auth";
import { useState } from "react";

const GASLESS_SEND_ENABLED = process.env.NEXT_PUBLIC_FEATURE_GASLESS_SEND === "true";

interface WalletTabProps {
  address: `0x${string}`;
}

export function WalletTab({ address }: WalletTabProps) {
  const { user } = usePrivy();
  const { wallets } = useWallets();
  const { exportWallet } = useExportWallet();
  const { linkEmail, linkGoogle, linkApple, linkWallet } = useLinkAccount();

  const [fundOpen, setFundOpen] = useState(false);
  const [sendModal, setSendModal] = useState<{
    open: boolean;
    symbol: string;
    token: TransferToken;
    max: number;
  } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  async function handleExport() {
    setExporting(true);
    setExportError(null);
    try {
      await exportWallet();
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  // Linked accounts from the Privy user object
  const linked = user?.linkedAccounts ?? [];
  const hasEmail = !!user?.email?.address;
  const hasGoogle = !!user?.google?.email;
  const hasApple = !!user?.apple?.email;

  // The embedded wallet (if any)
  const embeddedWallet = wallets.find((w) => w.walletClientType === "privy");

  const sectionHead: React.CSSProperties = {
    fontFamily: "var(--f-tech)",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: ".1em",
    textTransform: "uppercase" as const,
    color: "var(--muted-2)",
    marginBottom: 10,
    marginTop: 4,
  };

  const card: React.CSSProperties = {
    background: "#fff",
    border: "1px solid var(--line)",
    borderRadius: "var(--r-lg, 14px)",
    boxShadow: "var(--sh-1)",
    padding: "18px 20px",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Multi-chain balances */}
      <MultiChainWallet
        address={address}
        onBridge={() => setFundOpen(true)}
        onSend={(symbol, token, max) => {
          const tokenLower = symbol.toLowerCase() as TransferToken;
          if ((TRANSFER_TOKENS as readonly string[]).includes(tokenLower)) {
            setSendModal({ open: true, symbol, token: tokenLower, max });
          }
        }}
        sendEnabled={GASLESS_SEND_ENABLED}
      />

      {/* Embedded wallet management */}
      {embeddedWallet && (
        <div style={card}>
          <div style={sectionHead}>Embedded wallet</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: "var(--ink)" }}>
                  {address.slice(0, 8)}...{address.slice(-6)}
                </div>
                <div style={{ fontSize: 11, color: "var(--muted-2)", marginTop: 2 }}>
                  Privy embedded wallet
                </div>
              </div>
              <button
                type="button"
                onClick={handleExport}
                disabled={exporting}
                style={{
                  fontFamily: "var(--f-tech)",
                  fontSize: 11,
                  fontWeight: 700,
                  color: exporting ? "var(--muted)" : "var(--brand)",
                  background: "none",
                  border: "1px solid var(--line)",
                  borderRadius: 7,
                  padding: "6px 12px",
                  cursor: exporting ? "not-allowed" : "pointer",
                  flexShrink: 0,
                }}
              >
                {exporting ? "Opening..." : "Export private key"}
              </button>
            </div>
            {exportError && <div style={{ fontSize: 12, color: "var(--no)" }}>{exportError}</div>}
            <p style={{ margin: 0, fontSize: 11, color: "var(--muted-2)", lineHeight: 1.5 }}>
              Export opens a Privy-secured dialog where you can copy your private key. Your key
              never passes through FX Terminal servers.
            </p>
          </div>
        </div>
      )}

      {/* Link accounts */}
      <div style={card}>
        <div style={sectionHead}>Linked accounts</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {/* Email */}
          <AccountRow
            label={hasEmail ? (user?.email?.address ?? "Email") : "Email"}
            linked={hasEmail}
            onLink={() => linkEmail()}
          />
          {/* Google */}
          <AccountRow
            label={hasGoogle ? (user?.google?.email ?? "Google") : "Google"}
            linked={hasGoogle}
            onLink={() => linkGoogle()}
          />
          {/* Apple */}
          <AccountRow label="Apple" linked={hasApple} onLink={() => linkApple()} />
          {/* External wallet */}
          <AccountRow
            label="External wallet"
            linked={linked.some((a) => a.type === "wallet" && a.walletClientType !== "privy")}
            onLink={() => linkWallet()}
          />
        </div>
        <p style={{ margin: "12px 0 0", fontSize: 11, color: "var(--muted-2)", lineHeight: 1.5 }}>
          Linking additional login methods means you can recover this wallet from multiple accounts.
          Unlinking is available in Privy account settings.
        </p>
      </div>

      {/* Funding hub */}
      <div
        style={{
          ...card,
          background: "var(--bg-soft)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)" }}>Fund your wallet</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>
            Need USDC.e on Polygon to bet, or USDC on Base for P2P?
          </div>
        </div>
        <button
          type="button"
          onClick={() => setFundOpen(true)}
          className="btn btn-primary"
          style={{ flexShrink: 0, fontSize: 13, padding: "8px 18px" }}
        >
          Bridge to Polygon
        </button>
      </div>

      {/* Modals */}
      <FundWalletModal open={fundOpen} onClose={() => setFundOpen(false)} />
      {GASLESS_SEND_ENABLED && sendModal && (
        <SendModal
          open={sendModal.open}
          onClose={() => setSendModal(null)}
          tokenSymbol={sendModal.symbol}
          token={sendModal.token}
          maxBalance={sendModal.max}
        />
      )}
    </div>
  );
}

// ─── AccountRow helper ────────────────────────────────────────────────────────

function AccountRow({
  label,
  linked,
  onLink,
}: {
  label: string;
  linked: boolean;
  onLink: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "8px 0",
        borderBottom: "1px solid var(--line)",
      }}
    >
      <span style={{ fontSize: 13, color: "var(--ink)", fontWeight: 600 }}>{label}</span>
      {linked ? (
        <span
          style={{
            fontFamily: "var(--f-tech)",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: ".06em",
            textTransform: "uppercase" as const,
            color: "var(--yes)",
            background: "var(--yes-soft)",
            borderRadius: 6,
            padding: "3px 8px",
          }}
        >
          Linked
        </span>
      ) : (
        <button
          type="button"
          onClick={onLink}
          style={{
            fontFamily: "var(--f-tech)",
            fontSize: 11,
            fontWeight: 700,
            color: "var(--brand)",
            background: "none",
            border: "1px solid var(--line)",
            borderRadius: 7,
            padding: "4px 10px",
            cursor: "pointer",
          }}
        >
          Link
        </button>
      )}
    </div>
  );
}
